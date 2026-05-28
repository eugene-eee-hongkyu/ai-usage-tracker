// /api/cron/anonymize-expired-users — 30일 grace 만료 deleted user 의 PII 익명화
// + 본인 활동 데이터 hard delete.
//
// 호출 경로:
//   - Vercel cron: 매일 02:00 UTC (vercel.json 등록). Authorization: Bearer <CRON_SECRET>
//   - manual: 동일 header 로 curl 가능
//
// 정책 결정 (2026-05-18):
//   - users row 는 보존 + PII 익명화 (email/name/github 등 NULL or sentinel).
//     이유: audit_logs.actor_user_id / invitations.invited_by FK 가 깨지지 않게.
//     hash chain audit 무결성 보존이 GDPR right-to-be-forgotten 보다 우선.
//   - 본인 활동 데이터 (snapshots, blocks, visits, api_tokens) 는 hard delete.
//   - 익명화 여부 판단: email 패턴 `deleted-{id}@anonymized` 로 검사 (별도 컬럼 회피).

import { NextRequest, NextResponse } from "next/server";
import {
  db,
  users,
  userSnapshots,
  periodSnapshots,
  userBlocks,
  dailyVisits,
  apiTokens,
} from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { and, isNotNull, lte, eq, notLike } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

const GRACE_DAYS = 30;

// constant-time Bearer 비교. 길이 다르면 false (timingSafeEqual 가 throw 하므로
// 사전 길이 체크). cron endpoint 는 30일 grace 만료 user 의 활동 데이터 hard
// delete 권한 — leak 시 영향이 크므로 timing leak 표면도 정리.
function bearerEquals(authHeader: string | null, secret: string): boolean {
  if (!authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!bearerEquals(authHeader, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 86400000);

  // 30일 지난 deleted_at + 아직 익명화되지 않은 (email 패턴 검사)
  const targets = await db
    .select({ id: users.id, email: users.email, deletedAt: users.deletedAt })
    .from(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lte(users.deletedAt, cutoff),
        notLike(users.email, "deleted-%@anonymized")
      )
    );

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, anonymized: 0 });
  }

  const anonymized: Array<{ id: number; previousEmail: string }> = [];
  for (const t of targets) {
    try {
      await db.transaction(async (tx) => {
        // 1) 본인 활동 데이터 hard delete (FK 위반 없도록 사용자 row 갱신 전에)
        await tx.delete(userSnapshots).where(eq(userSnapshots.userId, t.id));
        await tx.delete(periodSnapshots).where(eq(periodSnapshots.userId, t.id));
        await tx.delete(userBlocks).where(eq(userBlocks.userId, t.id));
        await tx.delete(dailyVisits).where(eq(dailyVisits.userId, t.id));
        await tx.delete(apiTokens).where(eq(apiTokens.userId, t.id));

        // 2) users row 익명화 — id 그대로 보존 (FK 깨지지 않음), PII 만 제거
        await tx
          .update(users)
          .set({
            email: `deleted-${t.id}@anonymized`,
            name: "(deleted)",
            githubId: null,
            avatarUrl: null,
            apiKeyHash: null,
            timezone: null,
            planTier: null,
            role: "deleted",
            permissions: {},
          })
          .where(eq(users.id, t.id));
      });

      anonymized.push({ id: t.id, previousEmail: t.email });
      await writeAudit({
        actorUserId: null,
        actorType: "system",
        action: "user.anonymize.grace_expired",
        targetType: "user",
        targetId: t.id,
        metadata: {
          previousEmail: t.email,
          deletedAt: t.deletedAt?.toISOString() ?? null,
          graceDays: GRACE_DAYS,
        },
      });
    } catch (e) {
      console.error(`[cron] anonymize user ${t.id} failed:`, (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true, anonymized: anonymized.length, users: anonymized });
}

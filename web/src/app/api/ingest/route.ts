// Thin HTTP wrapper. 인증 + userId 확정 → runIngest() 호출.
// 핵심 로직은 [lib/sync/run-ingest.ts] 로 추출되어 향후 CLI in-process binary 도 같은 함수 호출 가능.

import { NextRequest, NextResponse } from "next/server";
import { db, users, teamMembers, apiTokens, IS_LOCAL_MODE } from "@/lib/db";
import { ensureLocalUser } from "@/lib/local-user";
import { runIngest } from "@/lib/sync/run-ingest";
import { eq, and, isNull, asc } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // 로컬 단독 모드 (.pkg/.msi 인스톨러) — API key 인증 우회, 단일 사용자 자동 보장.
  let userRow: Array<{
    id: number;
    timezone: string | null;
    suspendedAt: Date | null;
    deletedAt: Date | null;
  }>;
  let matchedTokenId: number | null = null;
  if (IS_LOCAL_MODE) {
    const u = await ensureLocalUser();
    userRow = [{ id: u.id, timezone: u.timezone, suspendedAt: null, deletedAt: null }];
  } else {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
    // M6e (2026-05-21): 1차 — api_tokens.hash 매칭 (device-scope, revoke 가능).
    const tokenRow = await db
      .select({
        tokenId: apiTokens.id,
        userId: users.id,
        timezone: users.timezone,
        suspendedAt: users.suspendedAt,
        deletedAt: users.deletedAt,
      })
      .from(apiTokens)
      .innerJoin(users, eq(users.id, apiTokens.userId))
      .where(and(eq(apiTokens.hash, hash), isNull(apiTokens.revokedAt)))
      .limit(1);
    if (tokenRow[0]) {
      matchedTokenId = tokenRow[0].tokenId;
      userRow = [
        {
          id: tokenRow[0].userId,
          timezone: tokenRow[0].timezone,
          suspendedAt: tokenRow[0].suspendedAt,
          deletedAt: tokenRow[0].deletedAt,
        },
      ];
    } else {
      // Fallback (2026-05-21~ 1~2주 dual mode): users.api_key_hash 단일 컬럼 매칭.
      // 백필 누락 또는 옛 init 흐름에서 발급된 키 안전망. 추후 phase 에서 제거.
      userRow = await db
        .select({
          id: users.id,
          timezone: users.timezone,
          suspendedAt: users.suspendedAt,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(eq(users.apiKeyHash, hash))
        .limit(1);
    }
  }

  if (!userRow[0]) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // admin 이 suspend/delete 한 사용자의 launchd 가 계속 ingest 못 하게 차단.
  if (userRow[0].deletedAt) return NextResponse.json({ error: "deleted" }, { status: 403 });
  if (userRow[0].suspendedAt) return NextResponse.json({ error: "suspended" }, { status: 403 });

  // Phase 4.2 (M6a): teamId 확정. CLI ingest 는 session 없으니 team_members 의 첫 행.
  // LOCAL_MODE 면 team_id=1 (iskra.world, ensureLocalUser 가 자동 가입 처리는 별도).
  let teamId: number;
  if (IS_LOCAL_MODE) {
    teamId = 1; // local-user 흐름은 단일 팀
  } else {
    const memberRow = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userRow[0].id), isNull(teamMembers.deletedAt)))
      .orderBy(asc(teamMembers.joinedAt))
      .limit(1);
    if (!memberRow[0]) return NextResponse.json({ error: "no_team" }, { status: 403 });
    teamId = memberRow[0].teamId;
  }

  const body = await req.json();
  await runIngest(userRow[0].id, teamId, userRow[0].timezone, body);

  // M6e: 매칭된 token 의 last_used_at + metadata 갱신. fallback (users 단일 hash)
  // 경로면 matchedTokenId=null 이라 skip — 옛 CLI 가 metadata 안 보내도 안전.
  if (matchedTokenId !== null) {
    const envInfo = (body as { envInfo?: unknown })?.envInfo;
    const metadataUpdate: { lastUsedAt: Date; metadata?: unknown } = { lastUsedAt: new Date() };
    if (envInfo && typeof envInfo === "object") {
      metadataUpdate.metadata = envInfo;
    }
    await db.update(apiTokens).set(metadataUpdate).where(eq(apiTokens.id, matchedTokenId));
  }

  return NextResponse.json({ ok: true });
}

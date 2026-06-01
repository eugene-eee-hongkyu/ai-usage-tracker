// GET /api/platform-admin/ccusage-compat
// ccusage_compat_runs 테이블의 모든 run 을 사용자명과 같이 반환.
// Platform Admin 만. 본인이 jq + diff 로 분석.
//
// 쿼리 파라미터:
//   ?runId=N    — 단일 run 만 (raw payload 다운로드용)
//   ?userId=N   — 특정 사용자의 모든 run history
//   기본       — 최근 N건 (default 50)

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth-guards";
import { db, users, ccusageCompatRuns } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  const guard = await requirePlatformAdmin();
  if (guard.error) return guard.error;

  const runId = req.nextUrl.searchParams.get("runId");
  const userIdParam = req.nextUrl.searchParams.get("userId");

  if (runId) {
    const row = await db
      .select({
        id: ccusageCompatRuns.id,
        userId: ccusageCompatRuns.userId,
        userName: users.name,
        userEmail: users.email,
        tokenId: ccusageCompatRuns.tokenId,
        ranAt: ccusageCompatRuns.ranAt,
        cliVersion: ccusageCompatRuns.cliVersion,
        os: ccusageCompatRuns.os,
        ccusageOldVersion: ccusageCompatRuns.ccusageOldVersion,
        ccusageNewVersion: ccusageCompatRuns.ccusageNewVersion,
        codeburnOldVersion: ccusageCompatRuns.codeburnOldVersion,
        codeburnNewVersion: ccusageCompatRuns.codeburnNewVersion,
        payload: ccusageCompatRuns.payload,
      })
      .from(ccusageCompatRuns)
      .innerJoin(users, eq(users.id, ccusageCompatRuns.userId))
      .where(eq(ccusageCompatRuns.id, parseInt(runId)))
      .limit(1);
    if (!row[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(row[0]);
  }

  const rows = userIdParam
    ? await db
        .select({
          id: ccusageCompatRuns.id,
          userId: ccusageCompatRuns.userId,
          userName: users.name,
          tokenId: ccusageCompatRuns.tokenId,
          ranAt: ccusageCompatRuns.ranAt,
          cliVersion: ccusageCompatRuns.cliVersion,
          os: ccusageCompatRuns.os,
          ccusageOldVersion: ccusageCompatRuns.ccusageOldVersion,
          ccusageNewVersion: ccusageCompatRuns.ccusageNewVersion,
          codeburnOldVersion: ccusageCompatRuns.codeburnOldVersion,
          codeburnNewVersion: ccusageCompatRuns.codeburnNewVersion,
        })
        .from(ccusageCompatRuns)
        .innerJoin(users, eq(users.id, ccusageCompatRuns.userId))
        .where(eq(ccusageCompatRuns.userId, parseInt(userIdParam)))
        .orderBy(desc(ccusageCompatRuns.ranAt))
        .limit(DEFAULT_LIMIT)
    : await db
        .select({
          id: ccusageCompatRuns.id,
          userId: ccusageCompatRuns.userId,
          userName: users.name,
          tokenId: ccusageCompatRuns.tokenId,
          ranAt: ccusageCompatRuns.ranAt,
          cliVersion: ccusageCompatRuns.cliVersion,
          os: ccusageCompatRuns.os,
          ccusageOldVersion: ccusageCompatRuns.ccusageOldVersion,
          ccusageNewVersion: ccusageCompatRuns.ccusageNewVersion,
          codeburnOldVersion: ccusageCompatRuns.codeburnOldVersion,
          codeburnNewVersion: ccusageCompatRuns.codeburnNewVersion,
        })
        .from(ccusageCompatRuns)
        .innerJoin(users, eq(users.id, ccusageCompatRuns.userId))
        .orderBy(desc(ccusageCompatRuns.ranAt))
        .limit(DEFAULT_LIMIT);

  return NextResponse.json({ count: rows.length, runs: rows });
}

// GET /api/platform-admin/ccusage-compat
// CLI `compat-check` 결과 (api_tokens.metadata.lastCompatCheck) 를 모든 token 에서 모아 반환.
//
// 권한: Platform Admin 만.
// 응답: 각 token 별로 사용자명 + 디바이스명 + 마지막 compat-check payload.
// 사용처: 본인이 jq + diff 로 직접 분석 — 별도 UI 안 만듬 (PoC 단계).
//
// 큰 raw payload (~250KB × N) 가 한 응답에 다 들어옴. 3명 × 1 token 가정 작음.
// 한 token 만 좁히고 싶으면 ?tokenId=N 쿼리 파라미터.

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth-guards";
import { db, users, apiTokens } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requirePlatformAdmin();
  if ("error" in guard) return guard.error;

  const tokenIdParam = req.nextUrl.searchParams.get("tokenId");
  const where = tokenIdParam
    ? and(sql`${apiTokens.metadata} ? 'lastCompatCheck'`, eq(apiTokens.id, parseInt(tokenIdParam)))
    : sql`${apiTokens.metadata} ? 'lastCompatCheck'`;

  const rows = await db
    .select({
      tokenId: apiTokens.id,
      userId: apiTokens.userId,
      userName: users.name,
      userEmail: users.email,
      tokenName: apiTokens.name,
      lastCompatCheck: sql<unknown>`${apiTokens.metadata}->'lastCompatCheck'`,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(where);

  return NextResponse.json({ count: rows.length, runs: rows });
}

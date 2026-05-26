// CLI repair 흐름이 시작 시 호출 — 가지고 있는 api key 가 유효한지 (revoke 안 됐는지)
// 가볍게 확인. 200 OK / 401 unauthorized 만 반환. 데이터 변경 0.
//
// 배경: 영진님 케이스 (revoked token 으로 install.ps1 재실행) — repair 흐름이 옛 키
// 존재만 보고 OAuth init 을 skip 하던 silent fail. repair 가 이 endpoint 한 번 찔러
// 401 받으면 키 정리 + init 으로 fallback. install.sh 한 줄 self-heal.

import { NextRequest, NextResponse } from "next/server";
import { db, users, apiTokens, IS_LOCAL_MODE } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  if (IS_LOCAL_MODE) {
    return NextResponse.json({ ok: true, mode: "local" });
  }
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return NextResponse.json({ error: "missing_key" }, { status: 401 });
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");

  // 1차 — api_tokens 매칭 (device-scope 발급 키)
  const tokenRow = await db
    .select({
      tokenId: apiTokens.id,
      userId: apiTokens.userId,
      deletedAt: users.deletedAt,
      suspendedAt: users.suspendedAt,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(and(eq(apiTokens.hash, hash), isNull(apiTokens.revokedAt)))
    .limit(1);
  if (tokenRow[0]) {
    if (tokenRow[0].deletedAt) return NextResponse.json({ error: "deleted" }, { status: 401 });
    if (tokenRow[0].suspendedAt) return NextResponse.json({ error: "suspended" }, { status: 401 });
    return NextResponse.json({ ok: true, source: "api_token", tokenId: tokenRow[0].tokenId });
  }

  // 2차 (fallback, 1-2주 dual mode) — users.api_key_hash 매칭
  const userRow = await db
    .select({ id: users.id, deletedAt: users.deletedAt, suspendedAt: users.suspendedAt })
    .from(users)
    .where(eq(users.apiKeyHash, hash))
    .limit(1);
  if (userRow[0]) {
    if (userRow[0].deletedAt) return NextResponse.json({ error: "deleted" }, { status: 401 });
    if (userRow[0].suspendedAt) return NextResponse.json({ error: "suspended" }, { status: 401 });
    return NextResponse.json({ ok: true, source: "legacy" });
  }

  // 매칭 실패 — revoked 또는 잘못된 키
  return NextResponse.json({ error: "invalid_or_revoked" }, { status: 401 });
}

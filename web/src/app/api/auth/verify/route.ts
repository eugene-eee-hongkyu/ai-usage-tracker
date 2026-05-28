// CLI repair 흐름이 시작 시 호출 — 가지고 있는 api key 가 유효한지 (revoke 안 됐는지)
// 가볍게 확인. 200 OK / 401 unauthorized 만 반환. 데이터 변경 0.
//
// 배경: 영진님 케이스 (revoked token 으로 install.ps1 재실행) — repair 흐름이 옛 키
// 존재만 보고 OAuth init 을 skip 하던 silent fail. repair 가 이 endpoint 한 번 찔러
// 401 받으면 키 정리 + init 으로 fallback. install.sh 한 줄 self-heal.
//
// 보안 감사 (2026-05-28, M2):
//   1) 실패 응답을 단일 메시지로 통일 — 옛 동작 (deleted / suspended / invalid_or_revoked
//      / missing_key) 으로 사용자 상태 enumeration 가능. 외부 공격자가 stolen key 의
//      소유자 상태를 oracle 처럼 알아낼 수 있던 표면 제거.
//   2) IP 기반 in-memory rate limit (Vercel serverless 에서는 instance 단위라 완벽한
//      안전망은 아니지만, 단일 IP 의 무차별 시도는 차단). 정식 분산 rate limit 는 후속.

import { NextRequest, NextResponse } from "next/server";
import { db, users, apiTokens, IS_LOCAL_MODE } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

// IP 별 token bucket — 1분 윈도우당 30 시도. 초과 시 429 retry-after.
// Vercel serverless instance 단위 in-memory (instance 간 공유 X) 라 강한 보장은
// 아니지만, 단일 source 의 비정상 트래픽은 잡힘. Redis/Upstash 도입은 별도 phase.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const ipBuckets = new Map<string, { count: number; windowStart: number }>();

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const cur = ipBuckets.get(ip);
  if (!cur || now - cur.windowStart >= RATE_WINDOW_MS) {
    ipBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  cur.count += 1;
  if (cur.count > RATE_MAX) return false;
  ipBuckets.set(ip, cur);
  return true;
}

// 단일 실패 응답 — 모든 실패 케이스 (missing/invalid/revoked/deleted/suspended)
// 동일 status + body. enumeration 차단.
//
// 주의: 매 요청마다 새 Response 인스턴스 반환. module-level 상수로 캐싱하면
// NextResponse 의 body (ReadableStream) 가 첫 요청에서 소비된 후 다음 요청부터
// content-length: 0 으로 응답되는 회귀 (2026-05-28 e2e 검증 중 발견).
function invalidResponse() {
  return NextResponse.json({ error: "invalid" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (IS_LOCAL_MODE) {
    return NextResponse.json({ ok: true, mode: "local" });
  }

  // rate limit — IP 식별 (x-forwarded-for first hop, Vercel 자동 세팅).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(RATE_WINDOW_MS / 1000)) } }
    );
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return invalidResponse();
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
    if (tokenRow[0].deletedAt || tokenRow[0].suspendedAt) return invalidResponse();
    return NextResponse.json({ ok: true, source: "api_token", tokenId: tokenRow[0].tokenId });
  }

  // 2차 (fallback, 1-2주 dual mode) — users.api_key_hash 매칭
  const userRow = await db
    .select({ id: users.id, deletedAt: users.deletedAt, suspendedAt: users.suspendedAt })
    .from(users)
    .where(eq(users.apiKeyHash, hash))
    .limit(1);
  if (userRow[0]) {
    if (userRow[0].deletedAt || userRow[0].suspendedAt) return invalidResponse();
    return NextResponse.json({ ok: true, source: "legacy" });
  }

  return invalidResponse();
}

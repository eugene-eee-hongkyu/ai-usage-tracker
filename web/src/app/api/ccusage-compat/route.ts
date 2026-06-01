// ccusage 신/구 버전 raw daily 출력 비교용 endpoint.
// CLI `compat-check` 가 두 ccusage 버전으로 capture 한 raw JSON 4쌍 + meta 를 받아
// api_tokens.metadata.lastCompatCheck 에 저장한다. PoC 단계라 history 1건만 (덮어쓰기).
//
// 인증: /api/ingest 와 동일 (x-api-key → apiTokens.hash 매칭).
// LOCAL_MODE 의미 없음 → 거부.
// 결과 확인: /api/platform-admin/ccusage-compat (별도 admin endpoint, 본인이 조회).

import { NextRequest, NextResponse } from "next/server";
import { db, apiTokens, IS_LOCAL_MODE } from "@/lib/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import crypto from "crypto";

// 250KB 4쌍 정도 가정 — 안전망 1MB 까지 허용.
const MAX_BODY = 1_000_000;

export async function POST(req: NextRequest) {
  if (IS_LOCAL_MODE) {
    return NextResponse.json({ error: "compat-check is prod-only" }, { status: 400 });
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const tokenRow = await db
    .select({ tokenId: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(and(eq(apiTokens.hash, hash), isNull(apiTokens.revokedAt)))
    .limit(1);
  if (!tokenRow[0]) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: `body too large (${raw.length} > ${MAX_BODY})` }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // 최소 필수 키 — 형태만 확인. raw shape 검증은 분석 시 본인이 직접.
  for (const k of ["cliVersion", "runAt", "os", "oldVersion", "newVersion", "claude", "codex"]) {
    if (!(k in body)) {
      return NextResponse.json({ error: `missing key: ${k}` }, { status: 400 });
    }
  }

  // jsonb merge — 다른 metadata 키 (lastIngestTelemetry 등) 보존.
  const savedAt = new Date().toISOString();
  const payload = { ...body, savedAt };
  await db
    .update(apiTokens)
    .set({
      metadata: sql`coalesce(${apiTokens.metadata}, '{}'::jsonb) || ${JSON.stringify({ lastCompatCheck: payload })}::jsonb`,
    })
    .where(eq(apiTokens.id, tokenRow[0].tokenId));

  return NextResponse.json({
    ok: true,
    tokenId: tokenRow[0].tokenId,
    bodySize: raw.length,
    savedAt,
  });
}

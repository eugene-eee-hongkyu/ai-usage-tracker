// ccusage / codeburn 핀 bump 전 raw 출력 비교용 endpoint.
// CLI `compat-check` 가 두 도구의 양 버전 raw JSON 묶음을 받아 ccusage_compat_runs
// 테이블에 새 row INSERT. 같은 사용자가 반복 실행하면 history 누적.
//
// 인증: /api/ingest 와 동일 (x-api-key → apiTokens.hash 매칭).
// LOCAL_MODE 의미 없음 → 거부.
// 결과 확인: /api/platform-admin/ccusage-compat (admin 만).
//
// 이전엔 api_tokens.metadata.lastCompatCheck 박았으나 ingest 의 metadata 통째
// REPLACE 버그로 매 sync 마다 증발. ingest 는 jsonb merge fix 적용했고, 검증 도구
// 데이터는 prod 메타와 완전 분리해 새 테이블로 격상 (2026-06-01).

import { NextRequest, NextResponse } from "next/server";
import { db, apiTokens, ccusageCompatRuns, IS_LOCAL_MODE } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

// ccusage 4 raw + codeburn 20 raw ≈ 1.6MB 추정. Vercel function body limit ~4.5MB.
const MAX_BODY = 5_000_000;

interface CompatBody {
  cliVersion?: string;
  runAt?: string;
  os?: string;
  ccusage?: { oldVersion?: string; newVersion?: string };
  codeburn?: { oldVersion?: string; newVersion?: string };
}

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
  let body: CompatBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // 필수 키 확인.
  const cli = body.cliVersion;
  const os = body.os;
  const ccOld = body.ccusage?.oldVersion;
  const ccNew = body.ccusage?.newVersion;
  const cbOld = body.codeburn?.oldVersion;
  const cbNew = body.codeburn?.newVersion;
  if (!cli || !os || !ccOld || !ccNew || !cbOld || !cbNew) {
    return NextResponse.json({
      error: "missing required keys: cliVersion / os / ccusage.{old,new}Version / codeburn.{old,new}Version",
    }, { status: 400 });
  }

  const inserted = await db.insert(ccusageCompatRuns).values({
    userId: tokenRow[0].userId,
    tokenId: tokenRow[0].tokenId,
    cliVersion: cli,
    os,
    ccusageOldVersion: ccOld,
    ccusageNewVersion: ccNew,
    codeburnOldVersion: cbOld,
    codeburnNewVersion: cbNew,
    payload: body as Record<string, unknown>,
  }).returning({ id: ccusageCompatRuns.id, ranAt: ccusageCompatRuns.ranAt });

  return NextResponse.json({
    ok: true,
    runId: inserted[0].id,
    ranAt: inserted[0].ranAt,
    bodySize: raw.length,
  });
}

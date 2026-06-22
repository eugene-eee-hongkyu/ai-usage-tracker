// /api/cron/cli-compat-check — 외부 CLI (codeburn, ccusage) 호환성 자동 검증
//
// 호출 경로:
//   - Vercel cron: 매일 09:00 UTC = KST 18시 (web/vercel.json 등록). Authorization: Bearer <CRON_SECRET>
//   - manual: 동일 header 로 curl 가능
//
// 동작:
//   1. codeburn + ccusage 각 패키지 현 핀 (pinned-versions.ts) vs npm latest 비교.
//   2. release notes diff + 의존 surface 키워드 매칭으로 호환성 판정.
//   3. 판정이 ⚠️ caution 또는 ❌ danger 일 때만 Resend 로 메일 발송.
//      판정이 ✓ safe 면 메일 안 보냄 — daily noise 0.
//
// 격리: npm install 절대 안 함. fetch (npm registry + GitHub API) 만.
// 사용자 PC / Vercel runner 의 글로벌 codeburn / ccusage 환경 변동 0 invariant.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { checkCliCompat, type PackageKey, type Verdict } from "@/lib/check-cli-compat";
import { sendCompatReport } from "@/lib/email";
import { db, cliCompatNotifications } from "@/lib/db";

export const dynamic = "force-dynamic";

const VERDICT_LABEL: Record<Verdict, string> = {
  safe: "✓ 안전",
  caution: "⚠️ 주의",
  danger: "❌ 위험",
  "fetch-failed": "fetch 실패",
};

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

  const targets: PackageKey[] = ["codeburn", "ccusage"];
  const results: Array<{
    pkg: PackageKey;
    from: string;
    to: string;
    verdict: Verdict;
    emailSent: boolean;
    alreadyNotified?: boolean;
    emailError?: string;
  }> = [];

  for (const pkg of targets) {
    try {
      const r = await checkCliCompat(pkg);
      let emailSent = false;
      let alreadyNotified = false;
      let emailError: string | undefined;
      if (r.verdict === "caution" || r.verdict === "danger") {
        // 같은 (pkg, from, to) 조합으로 이미 메일을 보냈으면 재발송 안 함.
        // 핀이 고정이라 latest 가 안 바뀌면 매일 같은 조합 → 1회만 발송 (버전 전환 시에만).
        const existing = await db
          .select({ id: cliCompatNotifications.id })
          .from(cliCompatNotifications)
          .where(
            and(
              eq(cliCompatNotifications.pkg, r.pkg),
              eq(cliCompatNotifications.fromVersion, r.from),
              eq(cliCompatNotifications.toVersion, r.to)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          alreadyNotified = true;
        } else {
          const sent = await sendCompatReport({
            pkg: r.pkg,
            from: r.from,
            to: r.to,
            verdictLabel: VERDICT_LABEL[r.verdict],
            markdown: r.reportMarkdown,
          });
          emailSent = sent.ok;
          emailError = sent.error;
          // 발송 성공 시에만 기록 — 실패하면 다음 cron 에서 재시도.
          if (sent.ok) {
            await db
              .insert(cliCompatNotifications)
              .values({
                pkg: r.pkg,
                fromVersion: r.from,
                toVersion: r.to,
                verdict: r.verdict,
              })
              .onConflictDoNothing();
          }
        }
      }
      results.push({
        pkg: r.pkg,
        from: r.from,
        to: r.to,
        verdict: r.verdict,
        emailSent,
        alreadyNotified,
        emailError,
      });
    } catch (e) {
      results.push({
        pkg,
        from: "?",
        to: "?",
        verdict: "fetch-failed",
        emailSent: false,
        emailError: (e as Error).message,
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

// cli-compat 오케스트레이터 — GitHub Actions(매일)가 실행하는 진입점.
//
// 패키지별로: 핀 vs 최신 실측 구조 검사(verify) → 변경 있으면 → dedup 확인(이미 보낸
// (pkg,from,to) 면 skip) → 릴리즈 노트 수집 → 이메일 조립 → Resend 발송 → dedup 기록.
//
// env:
//   RESEND_API_KEY              발송용 (없으면 발송 skip, 조립만)
//   EMAIL_FROM                  기본 "AI Usage Tracker <noreply@aiusage.z21labs.world>"
//   COMPAT_REPORT_TO_EMAIL      기본 "info@z21labs.xyz"
//   SUPABASE_URL                예: https://<ref>.supabase.co (dedup용)
//   SUPABASE_SERVICE_ROLE_KEY   dedup용 (RLS bypass)
//   GITHUB_TOKEN                릴리즈 노트 rate-limit 회피 (Actions 자동 주입)
//   DRY_RUN=1                   발송·기록 안 하고 로그만

import { verifyPackage, cmpVer } from "./verify.mjs";
import { collectReleaseNotes } from "./release-notes.mjs";
import { composeEmail } from "./email.mjs";
import { CONTRACT } from "./manifest.mjs";

const DRY = process.env.DRY_RUN === "1";
const FROM = process.env.EMAIL_FROM ?? "AI Usage Tracker <noreply@aiusage.z21labs.world>";
const TO = process.env.COMPAT_REPORT_TO_EMAIL ?? "info@z21labs.xyz";
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function log(...a) { console.log(...a); }

// ── dedup (Supabase PostgREST, service key 가 RLS bypass) ──────────────────────
async function alreadyNotified(pkg, from, to) {
  if (!SB_URL || !SB_KEY) { log(`  ⚠️ Supabase 미설정 — dedup 비활성(중복 발송 가능)`); return false; }
  const q = new URLSearchParams({ pkg: `eq.${pkg}`, from_version: `eq.${from}`, to_version: `eq.${to}`, select: "id" });
  const res = await fetch(`${SB_URL}/rest/v1/cli_compat_notifications?${q}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) { log(`  ⚠️ dedup 조회 실패 ${res.status} — 발송 진행`); return false; }
  return (await res.json()).length > 0;
}

async function recordNotified(pkg, from, to, verdict) {
  if (!SB_URL || !SB_KEY || DRY) return;
  await fetch(`${SB_URL}/rest/v1/cli_compat_notifications`, {
    method: "POST",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({ pkg, from_version: from, to_version: to, verdict }),
  });
}

// ── Resend 발송 ───────────────────────────────────────────────────────────────
async function sendEmail({ subject, html, text }) {
  if (DRY) { log(`  [DRY_RUN] 발송 skip — subject: ${subject}`); return { ok: true, dry: true }; }
  if (!process.env.RESEND_API_KEY) { log(`  ⚠️ RESEND_API_KEY 없음 — 발송 skip`); return { ok: false, error: "no key" }; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html, text }),
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
  return { ok: true, id: (await res.json()).id };
}

async function runPackage(pkg) {
  log(`\n=== ${pkg} ===`);
  const v = await verifyPackage(pkg);
  if (!v.changed) { log(`  ${v.from} = latest — 변경 없음, skip`); return { pkg, action: "no-change" }; }
  log(`  ${v.from} → ${v.to} — ${v.verdict}` + (v.breaking?.length ? ` (🔴 ${v.breaking.length})` : ""));

  if (await alreadyNotified(pkg, v.from, v.to)) {
    log(`  이미 (${pkg} ${v.from}→${v.to}) 발송됨 — skip`);
    return { pkg, action: "already-notified", from: v.from, to: v.to };
  }

  let notes = { value: [], structural: [], neutral: [], releaseCount: 0 };
  try {
    notes = await collectReleaseNotes(CONTRACT[pkg].githubRepo, v.from, v.to, cmpVer);
  } catch (e) {
    log(`  ⚠️ 릴리즈 노트 수집 실패: ${e.message} — 노트 없이 진행`);
  }

  const mail = composeEmail({ pkg, from: v.from, to: v.to, verify: v, notes });
  const sent = await sendEmail(mail);
  if (sent.ok) {
    await recordNotified(pkg, v.from, v.to, mail.verdict);
    log(`  ✅ 발송${sent.dry ? "(dry)" : ""} + 기록 — ${mail.subject}`);
    return { pkg, action: "sent", verdict: mail.verdict, from: v.from, to: v.to };
  }
  log(`  ❌ 발송 실패: ${sent.error}`);
  return { pkg, action: "send-failed", error: sent.error };
}

async function main() {
  const only = process.argv[2];
  const pkgs = only ? [only] : Object.keys(CONTRACT);
  const summary = [];
  for (const p of pkgs) {
    try { summary.push(await runPackage(p)); }
    catch (e) { log(`  ❌ ${p} 처리 중 오류: ${e.message}`); summary.push({ pkg: p, action: "error", error: e.message }); }
  }
  log(`\n=== 요약 ===`);
  for (const s of summary) log(`  ${s.pkg}: ${s.action}` + (s.verdict ? ` (${s.verdict})` : "") + (s.error ? ` — ${s.error}` : ""));
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });

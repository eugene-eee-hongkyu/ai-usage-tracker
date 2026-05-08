#!/usr/bin/env node
/**
 * ⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
 * consumer repo로 카피된 후엔 직접 수정하지 마세요.
 * 변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
 */

/**
 * diff-regression.mjs — 직전/현재 results.json 비교
 *
 * 사용:
 *   node scripts/diff-regression.mjs <prev.json> <curr.json>
 *   node scripts/diff-regression.mjs                       # 자동: report 디렉토리의 results.json 사용
 *
 * 출력:
 *   - 회귀: 어제 PASS → 오늘 FAIL  (우선 처리)
 *   - 회복: 어제 FAIL → 오늘 PASS  (정보)
 *   - 신규: 어제 없던 TC가 오늘 추가됨
 *   - 사라짐: 어제 있던 TC가 오늘 없어짐
 *
 * 종료 코드: 회귀 0건이면 0, 회귀 있으면 1 (CI에서 차단 가능)
 *
 * Telegram 연동: 환경 변수 TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID 있으면 회귀 메시지 전송
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

const args = process.argv.slice(2);
const prevPath = args[0] ?? resolve(root, 'playwright-report/results.prev.json');
const currPath = args[1] ?? resolve(root, 'playwright-report/results.json');

if (!existsSync(currPath)) {
  console.error(`❌ 현재 결과 파일 없음: ${currPath}`);
  process.exit(2);
}
if (!existsSync(prevPath)) {
  console.error(`❌ 직전 결과 파일 없음: ${prevPath}`);
  console.error(`   다음 실행 전에 현재 results.json을 results.prev.json으로 복사해두세요:`);
  console.error(`   cp playwright-report/results.json playwright-report/results.prev.json`);
  process.exit(2);
}

// ── results.json에서 TC-ID별 status 맵 추출 ────────────────────────────────────

const TC_RE = /^\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\]/;

function extractStatuses(jsonPath) {
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const map = new Map();

  function walk(suite) {
    for (const spec of suite.specs ?? []) {
      const m = spec.title.match(TC_RE);
      if (!m) continue;
      const id = m[1];
      const result = spec.tests?.[0]?.results?.[0];
      const status = result?.status ?? 'unknown';
      const error = result?.error?.message?.split('\n')[0]?.slice(0, 200) ?? null;
      map.set(id, { status, error });
    }
    for (const sub of suite.suites ?? []) walk(sub);
  }

  for (const fileSuite of data.suites ?? []) walk(fileSuite);
  return map;
}

const prev = extractStatuses(prevPath);
const curr = extractStatuses(currPath);

// ── 분류 ─────────────────────────────────────────────────────────────────────

function isPassLike(s) { return s === 'passed'; }
function isFailLike(s) { return s === 'failed' || s === 'timedOut' || s === 'interrupted'; }

const regressions = []; // pass → fail
const recoveries  = []; // fail → pass
const stillFailing = []; // fail → fail
const newTests = [];    // prev에 없음
const removedTests = []; // curr에 없음

for (const [id, c] of curr) {
  const p = prev.get(id);
  if (!p) { newTests.push({ id, ...c }); continue; }
  if (isPassLike(p.status) && isFailLike(c.status)) {
    regressions.push({ id, prevStatus: p.status, currStatus: c.status, error: c.error });
  } else if (isFailLike(p.status) && isPassLike(c.status)) {
    recoveries.push({ id, prevStatus: p.status, currStatus: c.status });
  } else if (isFailLike(p.status) && isFailLike(c.status)) {
    stillFailing.push({ id, currStatus: c.status });
  }
}
for (const [id, p] of prev) {
  if (!curr.has(id)) removedTests.push({ id, prevStatus: p.status });
}

// ── 출력 ─────────────────────────────────────────────────────────────────────

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  회귀 분석 (Regression Diff)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  직전 TC: ${prev.size}건`);
console.log(`  현재 TC: ${curr.size}건`);
console.log('');

if (regressions.length > 0) {
  console.log(`🚨 회귀 ${regressions.length}건 — 어제 PASS → 오늘 FAIL`);
  console.log('   (가장 우선 처리)\n');
  for (const r of regressions) {
    console.log(`  ${r.id.padEnd(15)} ${r.currStatus}${r.error ? '  — ' + r.error.slice(0, 120) : ''}`);
  }
  console.log('');
} else {
  console.log('✅ 회귀 없음\n');
}

if (recoveries.length > 0) {
  console.log(`✨ 회복 ${recoveries.length}건 — 어제 FAIL → 오늘 PASS`);
  for (const r of recoveries.slice(0, 20)) {
    console.log(`  ${r.id}`);
  }
  if (recoveries.length > 20) console.log(`  ... +${recoveries.length - 20}건`);
  console.log('');
}

if (stillFailing.length > 0) {
  console.log(`⏳ 지속 실패 ${stillFailing.length}건 — 어제도 오늘도 FAIL`);
  console.log('   (장기 미해결, 별도 트래킹 필요)');
  console.log('');
}

if (newTests.length > 0) {
  console.log(`➕ 신규 ${newTests.length}건 — 직전 결과에 없던 TC`);
  if (newTests.length <= 20) for (const n of newTests) console.log(`  ${n.id} (${n.status})`);
  else console.log(`  (생략)`);
  console.log('');
}

if (removedTests.length > 0) {
  console.log(`➖ 사라짐 ${removedTests.length}건 — 직전에 있었지만 현재 없음`);
  if (removedTests.length <= 20) for (const r of removedTests) console.log(`  ${r.id}`);
  else console.log(`  (생략)`);
  console.log('');
}

// ── Telegram 알림 (선택) ─────────────────────────────────────────────────────

const tgToken = process.env.TELEGRAM_BOT_TOKEN;
const tgChatId = process.env.TELEGRAM_CHAT_ID;
if (regressions.length > 0 && tgToken && tgChatId) {
  const lines = [
    `🚨 *회귀 ${regressions.length}건 감지*`,
    '',
    ...regressions.slice(0, 10).map(r => `\`${r.id}\` — ${r.currStatus}`),
    regressions.length > 10 ? `... +${regressions.length - 10}건` : '',
  ].filter(Boolean);
  const text = lines.join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChatId, text, parse_mode: 'Markdown' }),
    });
    console.log('📨 Telegram 알림 전송됨\n');
  } catch (e) {
    console.error(`Telegram 전송 실패: ${e.message}`);
  }
}

process.exit(regressions.length > 0 ? 1 : 0);

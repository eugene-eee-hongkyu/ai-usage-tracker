#!/usr/bin/env node
/**
 * ⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
 * consumer repo로 카피된 후엔 직접 수정하지 마세요.
 * 변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
 */

/**
 * QA 리포트 생성기
 * Playwright results.json → TC-ID 매핑 QA 결과 HTML 생성
 * 사용: node scripts/generate-qa-report.mjs [결과 파일 경로]
 *
 * 프로젝트별 설정은 루트의 qa-report.config.mjs에서 읽는다.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root   = resolve(__dir, '..');

// ── 프로젝트 설정 로드 ────────────────────────────────────────────────────────
const configPath = resolve(root, 'qa-report.config.mjs');
if (!existsSync(configPath)) {
  console.error(`❌ 설정 파일 없음: ${configPath}`);
  console.error('   프로젝트 루트에 qa-report.config.mjs를 작성하세요.');
  console.error('   샘플: docs/anchor-e2e-v2/qa-report-setup.md');
  process.exit(1);
}
const CONFIG = (await import(pathToFileURL(configPath).href)).default;

const BRAND = CONFIG.brand ?? { name: 'QA', subtitle: 'Report', initial: 'Q' };
const LINKS = CONFIG.links ?? { e2e: './index.html', playwright: './detail/index.html' };
const MODULES = CONFIG.modules ?? [];
if (!MODULES.length) {
  console.error('❌ qa-report.config.mjs의 modules 배열이 비어있습니다.');
  process.exit(1);
}

const jsonPath = process.argv[2] ?? resolve(root, 'playwright-report/results.json');
const htmlOut  = resolve(root, 'playwright-report/qa-report.html');

if (!existsSync(jsonPath)) {
  console.error(`결과 파일 없음: ${jsonPath}`);
  console.error('먼저 테스트를 실행하세요: npm run test:qa');
  process.exit(1);
}

const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

// ── docs/qa 활성 TC-ID 수 — 파일 직접 파싱 (삭제된 TC 제외) ─────────────────
const ACTIVE_ROW_RE2 = /^\|\s*([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\s*\|/;
const DELETED_ROW_RE2 = /^\|\s*~~([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)~~\s*\|/;
const TC_ID_RE2 = /^[A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*$/;

function buildDocsCounts(docsDir) {
  // 활성 + 삭제된 TC 모두 포함 (전체 docs 기준)
  const seen = new Set();
  const counts = {};
  if (!existsSync(docsDir)) return counts;
  for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const lines = readFileSync(join(docsDir, entry.name), 'utf-8').split('\n');
    for (const line of lines) {
      const del = line.match(DELETED_ROW_RE2);
      const act = line.match(ACTIVE_ROW_RE2);
      const tcId = del?.[1] ?? (act && TC_ID_RE2.test(act[1]) ? act[1] : null);
      if (!tcId || seen.has(tcId)) continue;
      seen.add(tcId);
      const mod = tcId.match(/^(HOME-TA|HOME-TP|[A-Z]+)/)?.[1] ?? '?';
      counts[mod] = (counts[mod] ?? 0) + 1;
    }
  }
  return counts;
}

const DOCS_COUNTS = buildDocsCounts(resolve(root, 'docs/qa'));
const DOCS_TOTAL = Object.values(DOCS_COUNTS).reduce((a, b) => a + b, 0);

// ── spec 파일 파싱 — test.skip() 이유 추출 ───────────────────────────────────

function parseSpecReasons(specDir) {
  const reasons = new Map(); // tcId → reason string

  function readDir(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) readDir(full);
      else if (entry.name.endsWith('.spec.ts')) parseSpec(full);
    }
  }

  function parseSpec(filePath) {
    const lines = readFileSync(filePath, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match: test.skip('[TC-ID...] title', — handles HOME-TA/HOME-TP compound prefixes
      const m = line.match(/test\.skip\(\s*['"](\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\][^'"]*)['"]/);
      if (!m) continue;
      const tcId = m[2];
      // Look for first // comment in next 6 lines (inside body)
      let reason = '';
      for (let j = i + 1; j < Math.min(i + 7, lines.length); j++) {
        if (lines[j].includes('});') || lines[j].match(/^\s*}\s*\);\s*$/)) break;
        const cm = lines[j].match(/\/\/\s*(.+)/);
        if (cm) { reason = cm[1].trim(); break; }
      }
      // Clean MANUAL:/SKIP:/DEPRECATED:/BLOCKED: prefixes
      reason = reason.replace(/^MANUAL:\s*/i, '').replace(/^SKIP:\s*/i, '').replace(/^DEPRECATED:\s*/i, '').replace(/^BLOCKED:\s*/i, '');
      reasons.set(tcId, reason || '사유 미기재');
    }
  }

  readDir(specDir);
  return reasons;
}

const specReasons = parseSpecReasons(resolve(root, 'tests/qa'));

// ── TC-ID 파서 ────────────────────────────────────────────────────────────────
// HOME-TA / HOME-TP 같은 복합 prefix 지원 — (?:-[A-Z]+)* 추가
const TC_RE = /^\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d-]+)\](\[M\]|\[S\]|\[D\]|\[B\])?/;

function parseTcId(title) {
  const m = title.match(TC_RE);
  if (!m) return null;
  return { id: m[1], tag: m[2] ?? '' };
}

function moduleOf(tcId) {
  // HOME-TA / HOME-TP 먼저 체크 (단순 split 시 HOME만 남음)
  const m = tcId.match(/^(HOME-TA|HOME-TP|[A-Z]+)/);
  return m ? m[1] : tcId.split('-')[0];
}

// ── 결과 수집 ─────────────────────────────────────────────────────────────────

function collectSpecs(suite, filePath) {
  const results = [];
  for (const spec of suite.specs ?? []) {
    const result = spec.tests?.[0]?.results?.[0] ?? {};
    results.push({
      file: filePath,
      title: spec.title,
      status: result.status ?? 'unknown',
      duration: result.duration ?? 0,
      error: result.error?.message?.split('\n')[0]?.slice(0, 200) ?? null,
    });
  }
  for (const sub of suite.suites ?? []) results.push(...collectSpecs(sub, filePath));
  return results;
}

const allSpecs = [];

for (const fileSuite of data.suites ?? []) {
  const file = fileSuite.file ?? fileSuite.title ?? '';
  if (!file.includes('qa/') && !file.includes('qa\\')) continue;
  allSpecs.push(...collectSpecs(fileSuite, file));
}

// ── TC-ID 매핑 ────────────────────────────────────────────────────────────────

const tcMap = new Map();

// 1) 결과 JSON 기반으로 채움
for (const spec of allSpecs) {
  const parsed = parseTcId(spec.title);
  if (!parsed) continue;
  const { id, tag } = parsed;
  const reason = specReasons.get(id) ?? '';
  tcMap.set(id, { id, tag, title: spec.title, status: spec.status, error: spec.error, file: spec.file, reason });
}

// 2) spec 파일 직접 파싱 — 결과 JSON에 없는 TC도 포함 ([D] 새로 추가된 것 등)
function collectAllSpecTcs(specDir) {
  const out = [];
  const ambiguous = []; // // AMBIGUOUS_DOC: 마크 검출
  const RE = /test(?:\.skip)?\s*\(\s*['"](\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\](\[M\]|\[S\]|\[D\]|\[B\])?[^'"]*)['"]/g;
  // active test() 본문에서 AMBIGUOUS_DOC 검출
  const TEST_BODY_RE = /\btest\s*\(\s*['"](\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\][^'"]+)['"][^{]*\{([\s\S]*?)\n\s{2,4}\}\s*\)\s*;/g;

  function walk(d) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.spec.ts')) {
        const content = readFileSync(full, 'utf-8');
        let m;
        while ((m = RE.exec(content)) !== null) {
          out.push({ id: m[2], tag: m[3] ?? '', title: m[1] });
        }
        RE.lastIndex = 0;
        let bm;
        while ((bm = TEST_BODY_RE.exec(content)) !== null) {
          const body = bm[3];
          const am = body.match(/\/\/\s*AMBIGUOUS_DOC:\s*([^\n]+)/i);
          if (am) ambiguous.push({ id: bm[2], note: am[1].trim() });
        }
        TEST_BODY_RE.lastIndex = 0;
      }
    }
  }
  walk(specDir);
  return { items: out, ambiguous };
}

const { items: specItemsAll, ambiguous: ambiguousMarks } = collectAllSpecTcs(resolve(root, 'tests/qa'));
for (const tc of specItemsAll) {
  if (tcMap.has(tc.id)) {
    // 결과 JSON에 있으면 tag만 보강 ([D]는 결과 status보다 우선)
    const existing = tcMap.get(tc.id);
    if (tc.tag && !existing.tag) existing.tag = tc.tag;
  } else {
    // 결과 JSON에 없는 TC — 정적 분류 (대부분 [D]/[M]/[S] test.skip)
    tcMap.set(tc.id, {
      id: tc.id, tag: tc.tag, title: tc.title,
      status: 'skipped', error: null, file: '',
      reason: specReasons.get(tc.id) ?? '',
    });
  }
}
// AMBIGUOUS_DOC 마크된 항목에 note 부착
const ambiguousMap = new Map(ambiguousMarks.map(a => [a.id, a.note]));

// ── 모듈별 그룹화 ─────────────────────────────────────────────────────────────

// config.modules에서 추출 — 순서/라벨 모두 설정 파일이 source of truth.
const moduleOrder = MODULES.map(m => m.id);
const moduleLabels = Object.fromEntries(MODULES.map(m => [m.id, `${m.id} — ${m.label}`]));

const byModule = new Map();
for (const mod of moduleOrder) byModule.set(mod, []);

for (const [, tc] of tcMap) {
  const mod = moduleOf(tc.id);
  if (!byModule.has(mod)) byModule.set(mod, []);
  byModule.get(mod).push(tc);
}

for (const [, tcs] of byModule) {
  tcs.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
}

// ── 결과 분류 ─────────────────────────────────────────────────────────────────

function classifyResult(tc) {
  if (tc.tag === '[D]') return 'deprecated';
  if (tc.tag === '[B]') return 'blocked';
  if (tc.tag === '[M]') return 'manual';
  if (tc.tag === '[S]') return 'skip';
  if (tc.status === 'passed') return 'pass';
  if (tc.status === 'failed' || tc.status === 'timedOut' || tc.status === 'interrupted') return 'fail';
  if (tc.status === 'skipped') return 'skip';
  return 'unknown';
}

function resultIcon(result) {
  return { pass: '✅', fail: '❌', manual: '⏭️', skip: '👤', deprecated: '🗑️', blocked: '🚧', unknown: '❓' }[result] ?? '❓';
}

function resultLabel(result) {
  return { pass: 'PASS', fail: 'FAIL', manual: '수동', skip: '스킵', deprecated: '삭제', blocked: '대기', unknown: '?' }[result] ?? '?';
}

// 스킵 이유 분류
function skipReasonLabel(tc) {
  if (tc.reason) return tc.reason;
  if (tc.status === 'skipped') return '조건부 스킵 — UI 요소 미노출 또는 기능 미제공 시 자동 스킵';
  return '사유 미기재';
}

// ── 집계 ──────────────────────────────────────────────────────────────────────

const now = new Date().toLocaleString('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
});

const allTcs = [...tcMap.values()];
const totalAll        = allTcs.length;
const totalPass       = allTcs.filter(t => classifyResult(t) === 'pass').length;
const totalFail       = allTcs.filter(t => classifyResult(t) === 'fail').length;
const totalManual     = allTcs.filter(t => classifyResult(t) === 'manual').length;
const totalSkip       = allTcs.filter(t => classifyResult(t) === 'skip').length;
const totalDeprecated = allTcs.filter(t => classifyResult(t) === 'deprecated').length;
const totalBlocked    = allTcs.filter(t => classifyResult(t) === 'blocked').length;
const autoTotal       = totalAll - totalManual - totalSkip - totalDeprecated - totalBlocked;
const overallStatus = totalFail > 0 ? 'FAIL' : 'PASS';
const coveragePct = Math.min(100, Math.round((totalAll / DOCS_TOTAL) * 100));
const notImpl = Math.max(0, DOCS_TOTAL - totalAll);

// ── HTML 생성 헬퍼 ────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortTitle(title) {
  return title.replace(/^\[[^\]]+\](\[M\]|\[S\]|\[D\]|\[B\])?\s*/, '');
}

function cleanAnsi(str) {
  if (!str) return '';
  return String(str).replace(/\[[\d;]*m/g, '').replace(/\[\d+m/g, '');
}

// ── 디자인: 커버리지 표 ──────────────────────────────────────────────────────

function coverageTable() {
  const rows = moduleOrder.map(mod => {
    const tcs = byModule.get(mod) ?? [];
    const docsTotal = DOCS_COUNTS[mod] ?? 0;
    if (!docsTotal && !tcs.length) return '';
    const impl = tcs.length;
    const todo = Math.max(0, docsTotal - impl);
    const pct = docsTotal > 0 ? Math.min(100, Math.round((impl / docsTotal) * 100)) : 0;
    const tone = pct < 80 ? 'bad' : pct < 90 ? 'warn' : '';
    const name = moduleLabels[mod]?.replace(/^[A-Z-]+\s*—\s*/, '') ?? '';
    return `<tr>
      <td><a class="mod" href="#module-${mod}"><span class="mod-tag">${mod}</span><span class="mod-name">${escHtml(name)}</span></a></td>
      <td class="r num">${docsTotal}</td>
      <td class="r num n-pass">${impl}</td>
      <td class="r num">${todo === 0 ? '<span class="dash">—</span>' : todo}</td>
      <td class="r"><div class="cov ${tone}"><div class="cov-track"><div class="cov-fill" style="width:${pct}%"></div></div><div class="cov-val num">${pct}%</div></div></td>
    </tr>`;
  }).filter(Boolean).join('\n');

  const totalNotImpl = notImpl;
  const coverageTone = coveragePct < 80 ? 'bad' : coveragePct < 90 ? 'warn' : '';
  return `<section id="coverage">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">01</span>자동화 커버리지</h2>
        <p class="sec-sub">docs/qa 기준 모듈별 자동화 스펙 구현 진행률 — 이번 빌드 기준 ${coveragePct}% 달성</p>
      </div>
      <div class="sec-tools">
        <span class="chip">기준 docs/qa</span>
        <span class="chip">${moduleOrder.length} modules</span>
      </div>
    </div>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th style="width:32%">모듈</th>
            <th class="r">DOCS 총계</th>
            <th class="r">구현</th>
            <th class="r">미구현</th>
            <th style="width:32%" class="r">커버리지</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>합계</td>
            <td class="r num">${DOCS_TOTAL}</td>
            <td class="r num n-pass">${totalAll}</td>
            <td class="r num">${totalNotImpl === 0 ? '<span class="dash">—</span>' : totalNotImpl}</td>
            <td class="r"><div class="cov ${coverageTone}"><div class="cov-track"><div class="cov-fill" style="width:${coveragePct}%"></div></div><div class="cov-val num">${coveragePct}%</div></div></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>`;
}

// ── 디자인: 실행 결과 표 ─────────────────────────────────────────────────────

function resultsTable() {
  const rows = moduleOrder.map(mod => {
    const tcs = byModule.get(mod) ?? [];
    if (!tcs.length) return '';
    const total = tcs.length;
    const p  = tcs.filter(t => classifyResult(t) === 'pass').length;
    const f  = tcs.filter(t => classifyResult(t) === 'fail').length;
    const d  = tcs.filter(t => classifyResult(t) === 'deprecated').length;
    const b  = tcs.filter(t => classifyResult(t) === 'blocked').length;
    const m  = tcs.filter(t => classifyResult(t) === 'manual').length;
    const sk = tcs.filter(t => classifyResult(t) === 'skip').length;
    const tot = total || 1;
    const num = (v, kind) => v === 0 ? '<span class="dash">—</span>' : `<span class="n-${kind}">${v}</span>`;
    return `<tr>
      <td>
        <div class="row-name">
          <a class="mod" href="#module-${mod}"><span class="mod-tag">${mod}</span></a>
          <div class="dist" aria-hidden>
            <span class="p" style="width:${p/tot*100}%"></span>
            <span class="f" style="width:${f/tot*100}%"></span>
            <span class="d" style="width:${d/tot*100}%"></span>
            <span class="b" style="width:${b/tot*100}%"></span>
            <span class="m" style="width:${m/tot*100}%"></span>
            <span class="s" style="width:${sk/tot*100}%"></span>
          </div>
        </div>
      </td>
      <td class="r num">${total}</td>
      <td class="r num">${num(p,'pass')}</td>
      <td class="r num">${num(f,'fail')}</td>
      <td class="r num">${num(d,'del')}</td>
      <td class="r num">${num(b,'blocked')}</td>
      <td class="r num">${num(m,'manual')}</td>
      <td class="r num">${num(sk,'skip')}</td>
    </tr>`;
  }).filter(Boolean).join('\n');

  return `<section id="results">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">02</span>실행 결과</h2>
        <p class="sec-sub">docs/qa ${totalAll}건의 모듈별 PASS · FAIL · 삭제 · 대기 · 수동 · 스킵 분포</p>
      </div>
      <div class="sec-tools">
        <span class="chip pass"><span class="pip"></span>PASS</span>
        <span class="chip fail"><span class="pip"></span>FAIL</span>
        <span class="chip del"><span class="pip"></span>삭제</span>
        <span class="chip blocked"><span class="pip"></span>대기</span>
        <span class="chip manual"><span class="pip"></span>수동</span>
        <span class="chip skip"><span class="pip"></span>스킵</span>
      </div>
    </div>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th style="width:26%">모듈</th>
            <th class="r">전체</th>
            <th class="r">PASS</th>
            <th class="r">FAIL</th>
            <th class="r">삭제</th>
            <th class="r">대기</th>
            <th class="r">수동</th>
            <th class="r">스킵</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>합계</td>
            <td class="r num">${totalAll}</td>
            <td class="r num n-pass">${totalPass}</td>
            <td class="r num n-fail">${totalFail || '<span class="dash">—</span>'}</td>
            <td class="r num n-del">${totalDeprecated || '<span class="dash">—</span>'}</td>
            <td class="r num n-blocked">${totalBlocked || '<span class="dash">—</span>'}</td>
            <td class="r num n-manual">${totalManual || '<span class="dash">—</span>'}</td>
            <td class="r num n-skip">${totalSkip || '<span class="dash">—</span>'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>`;
}

// ── 디자인: 모듈별 상세 섹션 ─────────────────────────────────────────────────

function moduleSection(mod, idx) {
  const tcs = byModule.get(mod) ?? [];
  if (!tcs.length) return '';
  const label = moduleLabels[mod] ?? mod;
  const name = label.replace(/^[A-Z-]+\s*—\s*/, '');
  const p  = tcs.filter(t => classifyResult(t) === 'pass').length;
  const f  = tcs.filter(t => classifyResult(t) === 'fail').length;
  const d  = tcs.filter(t => classifyResult(t) === 'deprecated').length;
  const b  = tcs.filter(t => classifyResult(t) === 'blocked').length;
  const m  = tcs.filter(t => classifyResult(t) === 'manual').length;
  const sk = tcs.filter(t => classifyResult(t) === 'skip').length;

  const headerChips = [
    p  > 0 ? `<span class="chip pass"><span class="pip"></span>PASS ${p}</span>` : '',
    f  > 0 ? `<span class="chip fail"><span class="pip"></span>FAIL ${f}</span>` : '',
    d  > 0 ? `<span class="chip del"><span class="pip"></span>삭제 ${d}</span>` : '',
    b  > 0 ? `<span class="chip blocked"><span class="pip"></span>대기 ${b}</span>` : '',
    m  > 0 ? `<span class="chip manual"><span class="pip"></span>수동 ${m}</span>` : '',
    sk > 0 ? `<span class="chip skip"><span class="pip"></span>스킵 ${sk}</span>` : '',
  ].filter(Boolean).join('');

  const rows = tcs.map(tc => {
    const result = classifyResult(tc);
    const pillMap = { pass:'pass', fail:'fail', deprecated:'del', blocked:'blocked', manual:'manual', skip:'skip' };
    const pillLabel = { pass:'PASS', fail:'FAIL', deprecated:'삭제', blocked:'대기', manual:'수동', skip:'스킵' };
    const cls = pillMap[result] ?? 'skip';
    const lbl = pillLabel[result] ?? result;
    return `<tr id="tc-${escHtml(tc.id)}">
      <td><span class="tc-id">${escHtml(tc.id)}</span></td>
      <td><span class="pill ${cls}"><span class="pip"></span>${lbl}</span></td>
      <td>${escHtml(shortTitle(tc.title))}</td>
    </tr>`;
  }).join('\n');

  return `<section id="module-${mod}">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">${String(idx).padStart(2,'0')}</span>${mod} 모듈 상세</h2>
        <p class="sec-sub">${escHtml(name)} — TC-ID · 결과 · 설명</p>
      </div>
    </div>
    <div class="card">
      <div class="mod-head">
        <div class="mod-head-l">
          <span class="mod-tag">${mod}</span>
          <span class="mod-name">${escHtml(name)}</span>
        </div>
        <div class="mod-head-r">${headerChips}</div>
      </div>
      <table class="lt">
        <thead>
          <tr>
            <th style="width:18%">TC-ID</th>
            <th style="width:14%">결과</th>
            <th>설명</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

// ── 디자인: 실패 상세 (카드형) ───────────────────────────────────────────────

function failDetails() {
  const failed = allTcs.filter(t => classifyResult(t) === 'fail');
  if (!failed.length) return '';
  const cards = failed.map(tc => {
    const msg = cleanAnsi(tc.error ?? '');
    return `<div class="fail">
      <span class="fail-id">${escHtml(tc.id)}</span>
      <div class="fail-body">
        <div class="fail-title">${escHtml(shortTitle(tc.title))}</div>
        ${msg ? `<div class="fail-msg" title="${escHtml(msg)}">${escHtml(msg)}</div>` : ''}
      </div>
      <a class="fail-link" href="#tc-${escHtml(tc.id)}">상세 →</a>
    </div>`;
  }).join('\n');
  return `<section id="fail-details">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">03</span>실패 상세 <span class="chip" style="margin-left:6px">${failed.length}건</span></h2>
        <p class="sec-sub">우선 처리해야 하는 케이스. 대부분은 60s 타임아웃 — 셀렉터 또는 비동기 로딩 점검 필요.</p>
      </div>
    </div>
    <div class="fails">${cards}</div>
  </section>`;
}

// ── 디자인: 수동 검증 ────────────────────────────────────────────────────────

function manualTable() {
  const manuals = allTcs.filter(t => classifyResult(t) === 'manual');
  if (!manuals.length) return '';
  const rows = manuals.map(tc => `
    <tr>
      <td><span class="tc-id">${escHtml(tc.id)}</span></td>
      <td>${escHtml(shortTitle(tc.title))}</td>
      <td class="reason">${escHtml(tc.reason || '수동 검증 필요 — 자동화 불가 영역')}</td>
    </tr>`).join('\n');
  return `<section id="manual-checks">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">05</span>수동 검증 필요 <span class="chip" style="margin-left:6px">${manuals.length}건</span></h2>
        <p class="sec-sub">OAuth · 이메일 인증 · SMS · PG 결제 · PDF 내용 등 자동화가 불가하거나 권장되지 않는 케이스</p>
      </div>
    </div>
    <div class="notice info">
      <div class="notice-ico">i</div>
      <div>아래 항목은 자동화가 불가하거나 권장되지 않는 케이스입니다. 사람이 직접 확인해야 합니다.</div>
    </div>
    <div class="card">
      <table class="lt">
        <thead>
          <tr>
            <th style="width:18%">TC-ID</th>
            <th>설명</th>
            <th style="width:34%">수동 검증 이유</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

// ── 디자인: docs 모호 의심 ───────────────────────────────────────────────────
// Eugene 일괄 리뷰 대상. Full QA는 끊김 없이 끝까지 가고, 여기서 한 번에 결정.

function ambiguousTable() {
  // 1) AMBIGUOUS_DOC 마크된 active test
  const interpretedRows = [...ambiguousMap.entries()].map(([id, note]) => ({ id, note, kind: 'interpreted' }));
  // 2) [B] BLOCKED인데 사유에 "docs 모호" 키워드
  const blockedAmbig = allTcs
    .filter(t => classifyResult(t) === 'blocked' && /docs.*모호|명확화.*필요|기대결과.*모호/i.test(t.reason || ''))
    .map(t => ({ id: t.id, note: t.reason, kind: 'blocked' }));

  if (interpretedRows.length === 0 && blockedAmbig.length === 0) return '';

  const interpretedTable = interpretedRows.length > 0 ? `
    <div class="card" style="margin-bottom:12px">
      <div class="mod-head">
        <div class="mod-head-l">
          <span class="pill" style="background:#FAEFD8;color:#B26A00"><span class="pip" style="background:#B26A00"></span>AI 해석</span>
          <span class="mod-name">${interpretedRows.length}건 — 단언이 작성되어 실행됨, 해석 검토 필요</span>
        </div>
      </div>
      <table class="lt">
        <thead>
          <tr><th style="width:18%">TC-ID</th><th>AI 해석 + 신뢰도</th></tr>
        </thead>
        <tbody>
          ${interpretedRows.map(r => `
            <tr>
              <td><span class="tc-id">${escHtml(r.id)}</span></td>
              <td class="reason">${escHtml(r.note)}</td>
            </tr>`).join('\n')}
        </tbody>
      </table>
    </div>` : '';

  const blockedTableHtml = blockedAmbig.length > 0 ? `
    <div class="card">
      <div class="mod-head">
        <div class="mod-head-l">
          <span class="pill" style="background:#E4F0F7;color:#3B82A6"><span class="pip" style="background:#3B82A6"></span>명확화 필요</span>
          <span class="mod-name">${blockedAmbig.length}건 — anchor 팀 docs 명확화 또는 Eugene 결정 대기</span>
        </div>
      </div>
      <table class="lt">
        <thead>
          <tr><th style="width:18%">TC-ID</th><th>모호 사유</th></tr>
        </thead>
        <tbody>
          ${blockedAmbig.map(r => `
            <tr>
              <td><span class="tc-id">${escHtml(r.id)}</span></td>
              <td class="reason">${escHtml(r.note || '(사유 미기재)')}</td>
            </tr>`).join('\n')}
        </tbody>
      </table>
    </div>` : '';

  return `<section id="ambiguous-docs">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">04</span>docs 모호 의심 <span class="chip" style="margin-left:6px">${interpretedRows.length + blockedAmbig.length}건</span></h2>
        <p class="sec-sub">Full QA는 끊김 없이 끝까지 — 여기서 일괄 검토하여 다음 사이클에 결정 반영</p>
      </div>
    </div>
    ${interpretedTable}
    ${blockedTableHtml}
  </section>`;
}

// ── 디자인: 출시 대기 (Blocked) ──────────────────────────────────────────────

function blockedTable() {
  const blocks = allTcs.filter(t => classifyResult(t) === 'blocked');
  if (!blocks.length) return '';
  const rows = blocks.map(tc => `
    <tr>
      <td><span class="tc-id">${escHtml(tc.id)}</span></td>
      <td>${escHtml(shortTitle(tc.title))}</td>
      <td class="reason">${escHtml(tc.reason || 'UI 미출시 — 출시 후 자동화 가능')}</td>
    </tr>`).join('\n');
  return `<section id="blocked-list">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">06</span>출시 대기 <span class="chip" style="margin-left:6px">${blocks.length}건</span></h2>
        <p class="sec-sub">UI 미출시 또는 의존 기능 미배포로 일시 비활성화 — 출시 후 즉시 자동화 활성화 가능</p>
      </div>
    </div>
    <div class="card">
      <table class="lt">
        <thead>
          <tr>
            <th style="width:18%">TC-ID</th>
            <th>설명</th>
            <th style="width:34%">대기 사유</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

// ── 디자인: 요구기능 삭제 ────────────────────────────────────────────────────

function deprecatedTable() {
  const deps = allTcs.filter(t => classifyResult(t) === 'deprecated');
  if (!deps.length) return '';
  const rows = deps.map(tc => `
    <tr>
      <td><span class="tc-id">${escHtml(tc.id)}</span></td>
      <td>${escHtml(shortTitle(tc.title))}</td>
      <td class="reason">${escHtml(tc.reason || '요구사항 변경 — 서비스에서 해당 기능 제거됨')}</td>
    </tr>`).join('\n');
  return `<section id="deprecated-list">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">07</span>요구기능 삭제 <span class="chip" style="margin-left:6px">${deps.length}건</span></h2>
        <p class="sec-sub">docs/qa에 정의되어 있으나 요구사항 변경으로 서비스에서 제거된 케이스 — 테스트 대상에서 공식 제외</p>
      </div>
    </div>
    <div class="card">
      <table class="lt">
        <thead>
          <tr>
            <th style="width:18%">TC-ID</th>
            <th>설명</th>
            <th style="width:34%">삭제 사유</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

// ── 디자인: 스킵 (명시적/조건부 그룹) ────────────────────────────────────────

function skipTable() {
  const skips = allTcs.filter(t => classifyResult(t) === 'skip');
  if (!skips.length) return '';
  const explicit = skips.filter(t => t.tag === '[S]' || t.reason);
  const conditional = skips.filter(t => t.tag !== '[S]' && !t.reason);
  const rowOf = (tc, fallback) => `
    <tr>
      <td><span class="tc-id">${escHtml(tc.id)}</span></td>
      <td>${escHtml(shortTitle(tc.title))}</td>
      <td class="reason">${escHtml(tc.reason || fallback)}</td>
    </tr>`;
  let body = '';
  if (explicit.length) {
    body += `<tr class="group-row"><td colspan="3">📌 명시적 스킵 <span class="grp-num">— 테스트 자체가 비활성화됨 (${explicit.length}건)</span></td></tr>`;
    body += explicit.map(tc => rowOf(tc, '명시적 스킵')).join('\n');
  }
  if (conditional.length) {
    body += `<tr class="group-row"><td colspan="3">🔀 조건부 스킵 <span class="grp-num">— UI 요소 미노출 등 런타임 조건에 따라 스킵됨 (${conditional.length}건)</span></td></tr>`;
    body += conditional.map(tc => rowOf(tc, '조건부 스킵 — UI 요소가 없거나 기능 미제공 시 자동 스킵')).join('\n');
  }
  return `<section id="skip-list">
    <div class="sec-head">
      <div>
        <h2 class="sec-title"><span class="idx">08</span>스킵 <span class="chip" style="margin-left:6px">${skips.length}건</span></h2>
        <p class="sec-sub">현재 미구현 · 세션 파괴 위험 · 환경 불안정 등의 이유로 비활성화된 케이스</p>
      </div>
    </div>
    <div class="card">
      <table class="lt">
        <thead>
          <tr>
            <th style="width:18%">TC-ID</th>
            <th>설명</th>
            <th style="width:34%">스킵 이유</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}

// ── HTML 전체 ─────────────────────────────────────────────────────────────────

const dashLength = 2 * Math.PI * 50;
const ringOffset = dashLength - (dashLength * coveragePct / 100);
const autoRun = totalPass + totalFail; // 실제 자동 실행

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(BRAND.name)} QA 결과 리포트</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
  *,*::before,*::after{box-sizing:border-box}
  :root{
    --bg:#FAF9F6;
    --surface:#FFFFFF;
    --surface-2:#F5F3EE;
    --line:rgba(20,18,12,.08);
    --line-strong:rgba(20,18,12,.14);
    --ink:#1A1814;
    --ink-2:#3A362E;
    --ink-3:#6B6657;
    --ink-4:#9A9483;
    --pass:#1F8A4C;
    --pass-bg:#E8F4EC;
    --pass-bar:linear-gradient(90deg,#22A35A 0%,#1F8A4C 100%);
    --fail:#C13030;
    --fail-bg:#FBEBEB;
    --manual:#B26A00;
    --manual-bg:#FAEFD8;
    --skip:#5C6470;
    --skip-bg:#ECEDF0;
    --del:#7B5BB6;
    --del-bg:#EFEAF8;
    --blocked:#3B82A6;
    --blocked-bg:#E4F0F7;
  }
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);
    font-family:Pretendard,ui-sans-serif,-apple-system,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;
    font-feature-settings:"ss01","tnum";-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  .mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
  .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
  a{color:inherit}

  .page{max-width:1180px;margin:0 auto;padding:48px 32px 80px}

  /* Topbar */
  .topbar{display:flex;align-items:center;justify-content:space-between;gap:24px;
    padding-bottom:24px;border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:12px}
  .brand-mark{width:28px;height:28px;border-radius:7px;background:var(--ink);
    display:grid;place-items:center;color:var(--bg);font-weight:700;font-size:13px;letter-spacing:-.02em}
  .brand-name{font-size:14px;font-weight:600;letter-spacing:-.01em}
  .brand-sep{color:var(--ink-4);font-weight:400;margin:0 2px}
  .brand-sub{font-size:13px;color:var(--ink-3);font-weight:500}
  .top-meta{display:flex;align-items:center;gap:18px;font-size:13px;color:var(--ink-3)}
  .top-meta b{color:var(--ink-2);font-weight:600}
  .top-meta .dot{width:6px;height:6px;border-radius:50%;background:var(--pass);display:inline-block;
    margin-right:8px;box-shadow:0 0 0 4px var(--pass-bg)}
  .top-actions{display:flex;gap:8px}
  .btn{appearance:none;border:1px solid var(--line-strong);background:var(--surface);
    color:var(--ink-2);padding:8px 12px;border-radius:8px;font:inherit;font-size:12.5px;
    font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;
    transition:background .15s, border-color .15s}
  .btn:hover{background:var(--surface-2);border-color:var(--ink-4)}
  .btn-fail{color:var(--fail);border-color:color-mix(in oklab,var(--fail) 35%, transparent);background:var(--fail-bg)}
  .btn-fail:hover{background:color-mix(in oklab,var(--fail) 12%, var(--fail-bg))}

  /* Hero */
  .hero{padding:36px 0 28px;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:end}
  .hero-l h1{margin:0;font-size:32px;line-height:1.18;letter-spacing:-.022em;font-weight:700}
  .hero-l h1 em{font-style:normal;color:var(--ink-3);font-weight:600}
  .hero-l p{margin:14px 0 0;font-size:14px;color:var(--ink-3);line-height:1.55;max-width:50ch}
  .hero-r{display:flex;justify-content:flex-end}
  .ring-wrap{display:flex;align-items:center;gap:24px}
  .ring{position:relative;width:120px;height:120px;display:block}
  .ring svg{transform:rotate(-90deg);display:block;width:120px;height:120px}
  .ring-track{stroke:var(--line)}
  .ring-fill{stroke:url(#ringGrad);stroke-linecap:round}
  .ring-num{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    display:flex;align-items:baseline;justify-content:center;
    font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1;
    width:100%;text-align:center}
  .ring-num small{font-size:13px;color:var(--ink-3);font-weight:500;margin-left:2px;line-height:1}
  .ring-cap{font-size:12px;color:var(--ink-3);max-width:140px;line-height:1.5}
  .ring-cap b{display:block;color:var(--ink);font-size:13px;font-weight:600;margin-bottom:4px}

  /* KPI strip */
  .kpi-row{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--line);
    border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-top:20px}
  .kpi{background:var(--surface);padding:18px 20px;display:flex;flex-direction:column;gap:6px;position:relative;min-width:0}
  .kpi-l{font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3);
    display:flex;align-items:center;gap:6px;white-space:nowrap;min-width:0}
  .kpi-l .pip{width:8px;height:8px;border-radius:2px;flex:none}
  .kpi-v{font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1;display:block}
  .kpi-d{font-size:12px;color:var(--ink-3);margin-top:2px;line-height:1.4}
  .kpi-bar{position:absolute;left:0;right:0;bottom:0;height:2px;background:transparent}
  .kpi.pass   .pip{background:var(--pass)}    .kpi.pass   .kpi-bar{background:var(--pass)}
  .kpi.fail   .pip{background:var(--fail)}    .kpi.fail   .kpi-bar{background:var(--fail)}
  .kpi.del    .pip{background:var(--del)}     .kpi.del    .kpi-bar{background:var(--del)}
  .kpi.manual .pip{background:var(--manual)}  .kpi.manual .kpi-bar{background:var(--manual)}
  .kpi.skip   .pip{background:var(--skip)}    .kpi.skip   .kpi-bar{background:var(--skip)}
  .kpi.blocked .pip{background:var(--blocked)} .kpi.blocked .kpi-bar{background:var(--blocked)}
  /* keep all KPI values in the same ink tone for visual rhythm */

  /* Section */
  section{margin-top:56px}
  .sec-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px}
  .sec-title{font-size:18px;font-weight:700;letter-spacing:-.012em;margin:0;display:flex;align-items:baseline;gap:10px}
  .sec-title .idx{font-size:12px;font-weight:500;color:var(--ink-4);font-family:"JetBrains Mono",monospace;letter-spacing:0}
  .sec-sub{font-size:13px;color:var(--ink-3);margin:6px 0 0;font-weight:400}
  .sec-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .chip{font-size:11.5px;color:var(--ink-3);padding:5px 9px;border-radius:6px;
    background:var(--surface-2);border:1px solid var(--line);font-weight:500;display:inline-flex;align-items:center;gap:5px}
  .chip .pip{width:7px;height:7px;border-radius:2px}
  .chip.pass .pip{background:var(--pass)}
  .chip.fail .pip{background:var(--fail)}
  .chip.del .pip{background:var(--del)}
  .chip.manual .pip{background:var(--manual)}
  .chip.skip .pip{background:var(--skip)}
  .chip.blocked .pip{background:var(--blocked)}

  /* Notice */
  .notice{display:flex;gap:12px;padding:14px 16px;border-radius:10px;
    background:var(--manual-bg);border:1px solid color-mix(in oklab,var(--manual) 25%, transparent);
    margin-bottom:14px;font-size:13px;line-height:1.55;color:var(--ink-2)}
  .notice b{color:var(--ink);font-weight:600}
  .notice-ico{flex:none;width:18px;height:18px;border-radius:50%;background:var(--manual);
    color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700;margin-top:1px}
  .notice.info{background:var(--surface-2);border-color:var(--line)}
  .notice.info .notice-ico{background:var(--ink-3)}

  /* Card / Table shell */
  .card{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px}
  thead th{font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
    color:var(--ink-3);text-align:left;padding:13px 18px;background:var(--surface-2);
    border-bottom:1px solid var(--line);white-space:nowrap}
  thead th.r{text-align:right} thead th.c{text-align:center}
  tbody td{padding:14px 18px;border-bottom:1px solid var(--line);vertical-align:middle;color:var(--ink-2)}
  tbody tr:last-child td{border-bottom:0}
  tbody tr:hover td{background:color-mix(in oklab,var(--surface-2) 60%, transparent)}
  td.r{text-align:right} td.c{text-align:center}

  /* Module link */
  .mod{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink)}
  .mod-tag{font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:600;
    color:var(--ink);background:var(--surface-2);border:1px solid var(--line);padding:3px 7px;border-radius:5px}
  .mod-name{font-size:13px;color:var(--ink-3);font-weight:500}
  .mod:hover .mod-tag{background:var(--ink);color:var(--bg);border-color:var(--ink)}

  /* Coverage bar */
  .cov{display:flex;align-items:center;gap:14px;justify-content:flex-end}
  .cov-track{flex:1;max-width:240px;height:6px;background:var(--line);border-radius:99px;overflow:hidden}
  .cov-fill{height:100%;background:var(--pass-bar);border-radius:99px;transition:width .6s cubic-bezier(.2,.8,.2,1)}
  .cov.warn .cov-fill{background:linear-gradient(90deg,#E2A33A 0%,#B26A00 100%)}
  .cov.bad .cov-fill{background:linear-gradient(90deg,#E26B6B 0%,#C13030 100%)}
  .cov-val{font-weight:600;font-size:13px;min-width:40px;text-align:right;color:var(--ink)}
  .cov.warn .cov-val{color:var(--manual)}
  .cov.bad  .cov-val{color:var(--fail)}

  /* Numbers — body cells: neutral; only colored pip in row-name communicates kind. */
  .n-pass{color:var(--ink);font-weight:600}
  .n-fail{color:var(--ink);font-weight:600}
  .n-manual{color:var(--ink);font-weight:600}
  .n-skip{color:var(--ink);font-weight:600}
  .n-del{color:var(--ink);font-weight:600}
  .n-blocked{color:var(--ink);font-weight:600}
  /* footer accents — gentle, even across all kinds */
  tfoot td.n-pass{color:var(--pass)}
  tfoot td.n-fail{color:var(--fail)}
  tfoot td.n-manual{color:var(--manual)}
  tfoot td.n-skip{color:var(--skip)}
  tfoot td.n-del{color:var(--del)}
  tfoot td.n-blocked{color:var(--blocked)}
  .dash{color:var(--ink-4)}

  tfoot td{padding:14px 18px;background:var(--surface-2);font-weight:600;color:var(--ink);
    border-top:1px solid var(--line-strong)}
  tfoot td.r{text-align:right}

  /* Distribution micro-bar */
  .row-name{display:flex;flex-direction:column;gap:6px}
  .dist{display:flex;height:4px;border-radius:99px;overflow:hidden;background:var(--line);width:200px;max-width:100%}
  .dist span{display:block;height:100%}
  .dist .p{background:var(--pass)}
  .dist .f{background:var(--fail)}
  .dist .d{background:var(--del)}
  .dist .m{background:var(--manual)}
  .dist .s{background:var(--skip)}
  .dist .b{background:var(--blocked)}

  /* Status pill */
  .pill{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:99px;
    font-size:11.5px;font-weight:600;letter-spacing:.01em;line-height:1}
  .pill .pip{width:6px;height:6px;border-radius:50%}
  .pill.pass{background:var(--pass-bg);color:var(--pass)} .pill.pass .pip{background:var(--pass)}
  .pill.fail{background:var(--fail-bg);color:var(--fail)} .pill.fail .pip{background:var(--fail)}
  .pill.manual{background:var(--manual-bg);color:var(--manual)} .pill.manual .pip{background:var(--manual)}
  .pill.skip{background:var(--skip-bg);color:var(--skip)} .pill.skip .pip{background:var(--skip)}
  .pill.del{background:var(--del-bg);color:var(--del)} .pill.del .pip{background:var(--del)}
  .pill.blocked{background:var(--blocked-bg);color:var(--blocked)} .pill.blocked .pip{background:var(--blocked)}

  /* Fail cards — scoped to .fails to avoid colliding with .kpi.fail */
  .fails{display:flex;flex-direction:column;gap:8px}
  .fails > .fail{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:start;
    padding:16px 18px;background:var(--surface);border:1px solid var(--line);border-radius:10px;
    border-left:3px solid var(--fail)}
  .fail-id{font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:600;
    color:var(--fail);background:var(--fail-bg);padding:4px 8px;border-radius:5px;white-space:nowrap}
  .fail-body{display:flex;flex-direction:column;gap:6px;min-width:0}
  .fail-title{font-size:13.5px;font-weight:500;color:var(--ink)}
  .fail-msg{font-family:"JetBrains Mono",monospace;font-size:11.5px;line-height:1.5;color:var(--ink-3);
    background:var(--surface-2);padding:8px 10px;border-radius:6px;border:1px solid var(--line);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fail-link{font-size:12px;color:var(--ink-3);text-decoration:none;padding:4px 8px;border-radius:6px;
    border:1px solid var(--line);white-space:nowrap;align-self:start}
  .fail-link:hover{border-color:var(--ink-4);color:var(--ink)}

  /* List tables */
  .lt thead th{padding:11px 18px;font-size:11px}
  .lt tbody td{padding:12px 18px}
  .tc-id{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--ink);font-weight:500}
  .reason{color:var(--ink-3);font-size:12.5px}
  .group-row td{background:var(--surface-2);border-bottom:1px solid var(--line)!important;
    font-size:11px;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:.05em;padding:10px 18px}
  .group-row td .grp-num{color:var(--ink-4);margin-left:6px;font-weight:500;text-transform:none;letter-spacing:0}

  /* Module section header */
  .mod-head{display:flex;align-items:center;justify-content:space-between;gap:16px;
    padding:16px 20px;background:var(--surface-2);border-bottom:1px solid var(--line)}
  .mod-head-l{display:flex;align-items:center;gap:12px}
  .mod-head-l .mod-tag{font-size:13px;padding:5px 10px}
  .mod-head-l .mod-name{font-size:14px;color:var(--ink-2);font-weight:500}
  .mod-head-r{display:flex;gap:8px;flex-wrap:wrap}

  /* Module navigation */
  .modnav{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
  .modnav a{font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:600;
    text-decoration:none;color:var(--ink-3);background:var(--surface);border:1px solid var(--line);
    padding:5px 9px;border-radius:6px;transition:.15s}
  .modnav a:hover{color:var(--ink);border-color:var(--ink-4);background:var(--surface-2)}

  footer{margin-top:64px;padding-top:24px;border-top:1px solid var(--line);
    display:flex;justify-content:space-between;font-size:12px;color:var(--ink-4)}
  footer a{color:var(--ink-3);text-decoration:none}
  footer a:hover{color:var(--ink)}

  :target{scroll-margin-top:24px}

  @media (max-width:880px){
    .page{padding:32px 20px}
    .hero{grid-template-columns:1fr;gap:24px}
    .hero-r{justify-content:flex-start}
    .kpi-row{grid-template-columns:repeat(2,1fr)}
    .top-actions{display:none}
    .fails > .fail{grid-template-columns:auto 1fr}
    .fail-link{grid-column:1/-1;justify-self:end}
  }
</style>
</head>
<body>
<div class="page">

  <div class="topbar">
    <div class="brand">
      <div class="brand-mark">${escHtml(BRAND.initial ?? BRAND.name?.[0] ?? '?')}</div>
      <div class="brand-name">${escHtml(BRAND.name)} <span class="brand-sep">/</span> <span class="brand-sub">${escHtml(BRAND.subtitle ?? 'QA Report')}</span></div>
    </div>
    <div class="top-meta">
      <div><span class="dot"></span>실행 <b>${escHtml(now)}</b></div>
      <div>자동화 <b>${autoRun}</b> · 대기 <b>${totalBlocked}</b> · 수동 <b>${totalManual}</b> · 스킵 <b>${totalSkip}</b></div>
    </div>
    <div class="top-actions">
      ${totalFail > 0 ? `<a class="btn" href="#fail-details"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:var(--fail)"></span>FAIL ${totalFail}</a>` : ''}
      <a class="btn" href="${escHtml(LINKS.e2e)}">📋 E2E</a>
      <a class="btn" href="${escHtml(LINKS.playwright)}">🔍 Playwright</a>
    </div>
  </div>

  <div class="hero">
    <div class="hero-l">
      <h1>이번 빌드는 <em>${totalPass}건 통과</em>,<br/>${totalFail > 0 ? `실패 ${totalFail}건이 남아 있습니다.` : '실패 없이 모두 안정적입니다.'}</h1>
      <p>docs/qa에 정의된 ${DOCS_TOTAL}건이 자동화 스펙 파일에 ${totalAll}건 구현되어 커버리지는 ${coveragePct}%입니다. 이 중 ${totalDeprecated}건은 요구사항 변경으로 삭제, ${totalBlocked}건은 UI 출시 대기, ${totalManual}건은 수동 검증 영역입니다.</p>
      <div class="modnav">
        ${moduleOrder.filter(m => byModule.get(m)?.length).map(m => `<a href="#module-${m}">${m}</a>`).join('')}
        ${ambiguousMap.size > 0 ? '<a href="#ambiguous-docs">모호</a>' : ''}
        ${totalManual > 0 ? '<a href="#manual-checks">수동</a>' : ''}
        ${totalBlocked > 0 ? '<a href="#blocked-list">대기</a>' : ''}
        ${totalDeprecated > 0 ? '<a href="#deprecated-list">삭제</a>' : ''}
        ${totalSkip > 0 ? '<a href="#skip-list">스킵</a>' : ''}
        ${totalFail > 0 ? '<a href="#fail-details">실패</a>' : ''}
      </div>
    </div>
    <div class="hero-r">
      <div class="ring-wrap">
        <div class="ring">
          <svg width="120" height="120">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#22A35A"/>
                <stop offset="100%" stop-color="#1F8A4C"/>
              </linearGradient>
            </defs>
            <circle class="ring-track" cx="60" cy="60" r="50" fill="none" stroke-width="8"/>
            <circle class="ring-fill"  cx="60" cy="60" r="50" fill="none" stroke-width="8"
                    stroke-dasharray="${dashLength}" stroke-dashoffset="${ringOffset}"/>
          </svg>
          <div class="ring-num num">${coveragePct}<small>%</small></div>
        </div>
        <div class="ring-cap">
          <b>자동화 커버리지</b>
          ${totalAll} / ${DOCS_TOTAL} 구현
        </div>
      </div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi pass">
      <div class="kpi-l"><span class="pip"></span>PASS</div>
      <div class="kpi-v num">${totalPass}</div>
      <div class="kpi-d">${autoRun > 0 ? `자동화 ${autoRun}건 중 ${Math.round(totalPass/autoRun*100)}%` : '—'}</div>
      <div class="kpi-bar"></div>
    </div>
    <div class="kpi fail">
      <div class="kpi-l"><span class="pip"></span>FAIL</div>
      <div class="kpi-v num">${totalFail}</div>
      <div class="kpi-d">${totalFail > 0 ? '우선 처리 필요' : '안정'}</div>
      <div class="kpi-bar"></div>
    </div>
    <div class="kpi del">
      <div class="kpi-l"><span class="pip"></span>요구기능 삭제</div>
      <div class="kpi-v num">${totalDeprecated}</div>
      <div class="kpi-d">테스트 대상 제외</div>
      <div class="kpi-bar"></div>
    </div>
    <div class="kpi blocked">
      <div class="kpi-l"><span class="pip"></span>출시 대기</div>
      <div class="kpi-v num">${totalBlocked}</div>
      <div class="kpi-d">UI 출시 후 자동화</div>
      <div class="kpi-bar"></div>
    </div>
    <div class="kpi manual">
      <div class="kpi-l"><span class="pip"></span>수동 검증</div>
      <div class="kpi-v num">${totalManual}</div>
      <div class="kpi-d">자동화 불가 항목</div>
      <div class="kpi-bar"></div>
    </div>
    <div class="kpi skip">
      <div class="kpi-l"><span class="pip"></span>스킵</div>
      <div class="kpi-v num">${totalSkip}</div>
      <div class="kpi-d">정책상 제외</div>
      <div class="kpi-bar"></div>
    </div>
  </div>

  ${coverageTable()}

  ${resultsTable()}

  ${totalFail > 0 ? failDetails() : ''}

  ${ambiguousTable()}

  ${manualTable()}

  ${blockedTable()}

  ${deprecatedTable()}

  ${skipTable()}

  ${moduleOrder.map((mod, i) => moduleSection(mod, i + 9)).join('\n')}

  <footer>
    <div>${escHtml(BRAND.name)} QA · 자동 생성 리포트 · ${escHtml(now)}</div>
    <div>
      <a href="${escHtml(LINKS.e2e)}">E2E</a>
      <span style="margin:0 8px;color:var(--ink-4)">·</span>
      <a href="${escHtml(LINKS.playwright)}">Playwright</a>
    </div>
  </footer>

</div>
</body>
</html>`;

writeFileSync(htmlOut, html, 'utf-8');

console.log(`✅ QA 리포트 → ${htmlOut}`);
console.log(`   TC-ID 총 ${totalAll}건 (docs/qa ${DOCS_TOTAL}건 기준 커버리지 ${coveragePct}%)`);
console.log(`   PASS ${totalPass} | FAIL ${totalFail} | 삭제 ${totalDeprecated} | 대기 ${totalBlocked} | 수동 ${totalManual} | 스킵 ${totalSkip}`);
console.log(`   합계: ${totalPass + totalFail + totalDeprecated + totalBlocked + totalManual + totalSkip} / 미구현 ${notImpl}건`);

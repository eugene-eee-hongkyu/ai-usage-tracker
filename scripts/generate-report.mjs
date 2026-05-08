#!/usr/bin/env node
/**
 * ⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
 * consumer repo로 카피된 후엔 직접 수정하지 마세요.
 * 변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
 */

/**
 * Playwright JSON 결과 → summary.md + index.html 생성
 * 사용: node scripts/generate-report.mjs [결과 파일 경로]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const jsonPath = process.argv[2] ?? resolve(root, 'playwright-report/results.json');
const mdOut   = resolve(root, 'playwright-report/summary.md');
const htmlOut = resolve(root, 'playwright-report/index.html');

if (!existsSync(jsonPath)) {
  console.error(`결과 파일 없음: ${jsonPath}`);
  console.error('먼저 테스트를 실행하세요: npm run test:full');
  process.exit(1);
}

const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

// ── helpers ──────────────────────────────────────────────────────────────────

function getCategory(file) {
  if (file.includes('critical')) return 'P0';
  if (file.includes('/p1/') || file.startsWith('p1/')) return 'P1';
  if (file.includes('/p2/') || file.startsWith('p2/')) return 'P2';
  if (file.includes('visual')) return 'VR';
  return null;
}

function statusIcon(status) {
  return { passed: '✅', failed: '❌', skipped: '⏭', timedOut: '⏱' }[status] ?? '❓';
}

function statusDot(status) {
  return { passed: '🟢', failed: '🔴', skipped: '⚪', timedOut: '🟠' }[status] ?? '⚪';
}

function fmt(ms) {
  if (!ms) return '-';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function collectSpecs(suite) {
  const results = [];
  for (const spec of suite.specs ?? []) {
    const result = spec.tests?.[0]?.results?.[0] ?? {};
    results.push({
      title: spec.title,
      status: result.status ?? 'unknown',
      duration: result.duration ?? 0,
      error: result.error?.message?.split('\n')[0]?.slice(0, 120) ?? null,
    });
  }
  for (const sub of suite.suites ?? []) results.push(...collectSpecs(sub));
  return results;
}

// ── collect ───────────────────────────────────────────────────────────────────

const byCategory = { P0: [], P1: [], P2: [], VR: [] };

for (const fileSuite of data.suites ?? []) {
  const file = fileSuite.file ?? fileSuite.title ?? '';
  const cat = getCategory(file);
  if (!cat) continue;
  const specs = collectSpecs(fileSuite);
  if (specs.length === 0) continue;
  byCategory[cat].push({ file: file.replace(/\.spec\.ts$/, ''), specs });
}

const allSpecs = Object.values(byCategory).flat().flatMap(f => f.specs);
const totalPassed  = allSpecs.filter(s => s.status === 'passed').length;
const totalFailed  = allSpecs.filter(s => s.status === 'failed').length;
const totalSkipped = allSpecs.filter(s => s.status === 'skipped').length;
const totalDuration = allSpecs.reduce((sum, s) => sum + (s.duration ?? 0), 0);
const overallStatus = totalFailed > 0 ? 'FAIL' : 'PASS';

const now = new Date().toLocaleString('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
});

const categoryLabels = {
  P0: 'P0 — 핵심 기능 (매일 CI)',
  P1: 'P1 — 기능 회귀 방지 (주 1회)',
  P2: 'P2 — 전수 검증 (수동 트리거)',
  VR: 'VR — Visual Regression',
};

// ── Markdown ──────────────────────────────────────────────────────────────────

const mdLines = [];
mdLines.push(`# Anchor E2E 테스트 결과`);
mdLines.push(`\n> 실행일시: ${now}  |  총 소요: ${fmt(totalDuration)}\n`);
mdLines.push(`## 요약\n`);
mdLines.push(`| 구분 | 전체 | ✅ passed | ❌ failed | ⏭ skipped |`);
mdLines.push(`|---|---|---|---|---|`);

for (const cat of ['P0', 'P1', 'P2', 'VR']) {
  const specs = byCategory[cat].flatMap(f => f.specs);
  const p = specs.filter(s => s.status === 'passed').length;
  const f = specs.filter(s => s.status === 'failed').length;
  const sk = specs.filter(s => s.status === 'skipped').length;
  const icon = f > 0 ? '🔴' : sk > 0 ? '🟡' : '🟢';
  mdLines.push(`| ${icon} **${cat}** | ${specs.length} | ${p} | ${f > 0 ? f : '-'} | ${sk > 0 ? sk : '-'} |`);
}
mdLines.push(`| | **${allSpecs.length}** | **${totalPassed}** | **${totalFailed > 0 ? totalFailed : '-'}** | **${totalSkipped > 0 ? totalSkipped : '-'}** |`);

for (const cat of ['P0', 'P1', 'P2', 'VR']) {
  const files = byCategory[cat];
  if (!files.length) continue;
  mdLines.push(`\n---\n\n## ${categoryLabels[cat]}\n`);
  for (const { file, specs } of files) {
    const p = specs.filter(s => s.status === 'passed').length;
    const f = specs.filter(s => s.status === 'failed').length;
    mdLines.push(`### ${f > 0 ? '❌' : '✅'} ${file} (${p}/${specs.length})\n`);
    mdLines.push(`| 상태 | 테스트 | 시간 |`);
    mdLines.push(`|---|---|---|`);
    for (const s of specs) {
      const title = s.error ? `${s.title}<br><sub>💬 \`${s.error.replace(/\|/g, '\\|')}\`</sub>` : s.title;
      mdLines.push(`| ${statusIcon(s.status)} | ${title} | ${fmt(s.duration)} |`);
    }
    mdLines.push('');
  }
}

if (totalFailed > 0) {
  mdLines.push(`\n---\n\n## ❌ 실패 목록\n`);
  for (const cat of ['P0', 'P1', 'P2', 'VR']) {
    for (const { file, specs } of byCategory[cat]) {
      for (const s of specs.filter(sp => sp.status === 'failed')) {
        mdLines.push(`- **[${cat}]** \`${file}\` — ${s.title}`);
        if (s.error) mdLines.push(`  - \`${s.error}\``);
      }
    }
  }
}

writeFileSync(mdOut, mdLines.join('\n'), 'utf-8');

// ── HTML ──────────────────────────────────────────────────────────────────────

const snapshotDir = resolve(root, 'tests/visual/visual.spec.ts-snapshots');
const snapshots = existsSync(snapshotDir) ? readdirSync(snapshotDir).filter(f => f.endsWith('.png')) : [];

function catRows() {
  return ['P0', 'P1', 'P2', 'VR'].map(cat => {
    const specs = byCategory[cat].flatMap(f => f.specs);
    const p  = specs.filter(s => s.status === 'passed').length;
    const f  = specs.filter(s => s.status === 'failed').length;
    const sk = specs.filter(s => s.status === 'skipped').length;
    const cls = f > 0 ? 'fail' : sk > 0 && p === 0 ? 'skip' : 'pass';
    return `<tr class="${cls}">
      <td><strong>${cat}</strong></td>
      <td>${specs.length}</td>
      <td class="pass-cell">${p}</td>
      <td class="fail-cell">${f > 0 ? f : '—'}</td>
      <td class="skip-cell">${sk > 0 ? sk : '—'}</td>
    </tr>`;
  }).join('\n');
}

function fileSection(cat) {
  const files = byCategory[cat];
  if (!files.length) return '';
  let html = `<section><h2>${categoryLabels[cat]}</h2>`;
  for (const { file, specs } of files) {
    const p = specs.filter(s => s.status === 'passed').length;
    const f = specs.filter(s => s.status === 'failed').length;
    const cls = f > 0 ? 'fail' : 'pass';
    html += `<div class="file-block ${cls}">
      <div class="file-header">
        <span class="file-icon">${f > 0 ? '❌' : '✅'}</span>
        <code>${file}</code>
        <span class="file-count">${p}/${specs.length}</span>
      </div>
      <table>
        <thead><tr><th>상태</th><th>테스트</th><th>시간</th></tr></thead>
        <tbody>
          ${specs.map(s => `<tr class="spec-${s.status}">
            <td class="status-cell">${statusDot(s.status)}</td>
            <td class="title-cell">${escHtml(s.title)}${s.error ? `<div class="error-msg">${escHtml(s.error)}</div>` : ''}</td>
            <td class="dur-cell">${fmt(s.duration)}</td>
          </tr>`).join('\n')}
        </tbody>
      </table>
    </div>`;
  }
  return html + '</section>';
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function failSection() {
  const failed = ['P0','P1','P2','VR'].flatMap(cat =>
    byCategory[cat].flatMap(({ file, specs }) =>
      specs.filter(s => s.status === 'failed').map(s => ({ cat, file, ...s }))
    )
  );
  if (!failed.length) return '';
  return `<section class="fail-section">
    <h2>❌ 실패 목록</h2>
    <ul>
      ${failed.map(s => `<li>
        <span class="badge">${s.cat}</span>
        <code>${s.file}</code> — ${escHtml(s.title)}
        ${s.error ? `<div class="error-msg">${escHtml(s.error)}</div>` : ''}
      </li>`).join('\n')}
    </ul>
  </section>`;
}

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Anchor E2E 테스트 결과</title>
<style>
  :root {
    --pass: #16a34a; --fail: #dc2626; --skip: #9ca3af;
    --pass-bg: #f0fdf4; --fail-bg: #fef2f2; --skip-bg: #f9fafb;
    --border: #e5e7eb; --text: #111827; --muted: #6b7280;
    --code-bg: #f3f4f6;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         color: var(--text); background: #fff; line-height: 1.6; }
  .container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }

  /* header */
  header { display: flex; align-items: center; justify-content: space-between;
           margin-bottom: 32px; flex-wrap: wrap; gap: 12px; }
  header h1 { font-size: 1.6rem; font-weight: 700; }
  .meta { color: var(--muted); font-size: 0.85rem; }
  .badge-status { padding: 4px 12px; border-radius: 9999px; font-size: 0.8rem;
                  font-weight: 700; letter-spacing: 0.05em; }
  .badge-status.PASS { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass); }
  .badge-status.FAIL { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail); }

  /* detail link */
  .detail-link { display: inline-flex; align-items: center; gap: 6px;
                 padding: 8px 16px; background: #1e40af; color: #fff;
                 border-radius: 6px; text-decoration: none; font-size: 0.875rem;
                 font-weight: 500; transition: background 0.15s; }
  .detail-link:hover { background: #1d4ed8; }

  /* summary table */
  .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  .summary-table th, .summary-table td { padding: 10px 14px; text-align: left;
                                          border-bottom: 1px solid var(--border); }
  .summary-table th { font-size: 0.8rem; color: var(--muted); text-transform: uppercase;
                      letter-spacing: 0.06em; background: var(--code-bg); }
  .summary-table tr.pass td:first-child { border-left: 3px solid var(--pass); }
  .summary-table tr.fail td:first-child { border-left: 3px solid var(--fail); }
  .summary-table tr.skip td:first-child { border-left: 3px solid var(--skip); }
  .summary-table tfoot td { font-weight: 700; background: var(--code-bg); }
  .pass-cell { color: var(--pass); font-weight: 600; }
  .fail-cell { color: var(--fail); font-weight: 600; }
  .skip-cell { color: var(--skip); }

  /* sections */
  section { margin-bottom: 40px; }
  section h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 16px;
               padding-bottom: 8px; border-bottom: 2px solid var(--border); }

  /* file block */
  .file-block { border: 1px solid var(--border); border-radius: 8px;
                margin-bottom: 16px; overflow: hidden; }
  .file-block.fail { border-color: #fca5a5; }
  .file-header { display: flex; align-items: center; gap: 10px;
                 padding: 10px 14px; background: var(--code-bg); font-size: 0.875rem; }
  .file-block.fail .file-header { background: var(--fail-bg); }
  .file-icon { font-size: 1rem; }
  .file-count { margin-left: auto; color: var(--muted); font-size: 0.8rem; }
  code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.82rem;
         background: var(--code-bg); padding: 1px 4px; border-radius: 3px; }
  .file-header code { background: transparent; }

  /* spec table */
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  thead tr { background: #fafafa; }
  th { padding: 7px 12px; text-align: left; color: var(--muted);
       font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
       letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
  td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .spec-failed td { background: #fff5f5; }
  .spec-skipped td { color: var(--skip); }
  .status-cell { width: 32px; }
  .title-cell { width: auto; }
  .dur-cell { width: 70px; text-align: right; color: var(--muted); white-space: nowrap; }
  .error-msg { font-size: 0.78rem; color: var(--fail); margin-top: 3px;
               font-family: 'SF Mono', monospace; word-break: break-all; }

  /* fail section */
  .fail-section { background: var(--fail-bg); border: 1px solid #fca5a5;
                  border-radius: 8px; padding: 20px; }
  .fail-section h2 { border-color: #fca5a5; }
  .fail-section ul { padding-left: 18px; }
  .fail-section li { margin-bottom: 8px; font-size: 0.875rem; }
  .badge { display: inline-block; background: var(--fail); color: #fff;
           font-size: 0.72rem; font-weight: 700; padding: 1px 6px;
           border-radius: 4px; margin-right: 4px; vertical-align: middle; }

  /* vr section */
  .vr-note { background: var(--code-bg); border-radius: 8px; padding: 16px 20px;
             font-size: 0.85rem; color: var(--muted); margin-top: 12px; }
  .vr-note ul { padding-left: 18px; margin-top: 6px; }
  .vr-note li { line-height: 1.8; }
</style>
</head>
<body>
<div class="container">

  <header>
    <div>
      <h1>Anchor E2E 테스트 결과</h1>
      <div class="meta">실행일시: ${now} &nbsp;|&nbsp; 총 소요: ${fmt(totalDuration)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="badge-status ${overallStatus}">${overallStatus} ${overallStatus === 'PASS' ? '✓' : '✗'}</span>
      <a href="./detail/index.html" class="detail-link" target="_blank">
        🔍 전체 Playwright 리포트 →
      </a>
    </div>
  </header>

  <!-- 요약 표 -->
  <table class="summary-table">
    <thead>
      <tr><th>구분</th><th>전체</th><th>✅ passed</th><th>❌ failed</th><th>⏭ skipped</th></tr>
    </thead>
    <tbody>
      ${catRows()}
    </tbody>
    <tfoot>
      <tr>
        <td>합계</td>
        <td>${allSpecs.length}</td>
        <td class="pass-cell">${totalPassed}</td>
        <td class="${totalFailed > 0 ? 'fail-cell' : ''}">${totalFailed > 0 ? totalFailed : '—'}</td>
        <td class="skip-cell">${totalSkipped > 0 ? totalSkipped : '—'}</td>
      </tr>
    </tfoot>
  </table>

  ${totalFailed > 0 ? failSection() : ''}

  ${['P0','P1','P2','VR'].map(cat => fileSection(cat)).join('\n')}

  <!-- VR 베이스라인 -->
  <section>
    <h2>VR — 베이스라인 파일</h2>
    <div class="vr-note">
      VR 테스트 통과 시 diff 이미지 미생성. 베이스라인 갱신: <code>npm run visual:update</code>
      ${snapshots.length > 0 ? `<ul>${snapshots.map(f => `<li><code>${f}</code></li>`).join('')}</ul>` : ''}
    </div>
  </section>

</div>
</body>
</html>`;

writeFileSync(mdOut, mdLines.join('\n'), 'utf-8');
writeFileSync(htmlOut, html, 'utf-8');

console.log(`✅ MD   → ${mdOut}`);
console.log(`✅ HTML → ${htmlOut}`);
console.log(`   passed: ${totalPassed} | failed: ${totalFailed} | skipped: ${totalSkipped}`);

#!/usr/bin/env node
/**
 * ⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
 * consumer repo로 카피된 후엔 직접 수정하지 마세요.
 * 변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
 */

/**
 * analyze-ambiguous.mjs
 * AMBIGUOUS_DOC 마크된 spec 항목을 신뢰도 × 카테고리로 그룹핑하여
 * Eugene이 일괄 결정 가능한 markdown 리포트를 생성한다.
 *
 * 사용:
 *   node scripts/analyze-ambiguous.mjs > docs/ambiguous-review.md
 *
 * 카테고리 분류:
 *   1. docs-empty   — "docs 기대 결과 비어있음" / "docs ... 비어있음"
 *   2. docs-quote   — docs 원문 인용 ("docs '...'")
 *   3. env-dependent— "환경 의존" / "storage state"
 *   4. precondition — "사전조건" / "사전 데이터"
 *   5. ui-interaction — "버튼 disabled" / "클릭이 새창" 등 UI 동작 의존
 *   6. other        — 분류 불가
 *
 * 신뢰도 등급:
 *   T1 (75%+): 해석 신뢰 가능 → 강한 단언 보강 OK 가능성 높음
 *   T2 (60~70%): 해석 검토 필요
 *   T3 (≤55%): 신뢰 낮음 → docs 명확화 또는 BLOCKED 후보
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

// ── docs 기대 결과 로드 ─────────────────────────────────────────────
function loadDocsExpected(docsDir) {
  const map = {};
  if (!existsSync(docsDir)) return map;
  const TC_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*$/;
  for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const lines = readFileSync(join(docsDir, entry.name), 'utf-8').split('\n');
    let expectedColIdx = null;
    for (const line of lines) {
      if (line.includes('기대 결과') && line.includes('|')) {
        const headers = line.split('|').map((s) => s.trim());
        expectedColIdx = headers.findIndex((h) => h === '기대 결과');
        continue;
      }
      if (expectedColIdx !== null && line.startsWith('|')) {
        const cells = line.split('|').map((s) => s.trim());
        const id = cells[1]?.replace(/^~~|~~$/g, '');
        if (id && TC_ID.test(id) && cells[expectedColIdx]) {
          map[id] = cells[expectedColIdx];
        }
      }
    }
  }
  return map;
}

// ── AMBIGUOUS_DOC 항목 수집 ──────────────────────────────────────────
function collectItems(specDir) {
  const items = [];
  const TEST_BODY_RE = /\btest\s*\(\s*['"](\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\][^'"]+)['"][^{]*\{([\s\S]*?)\n\s{2,4}\}\s*\)\s*;/g;

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.spec.ts')) {
        const content = readFileSync(path, 'utf-8');
        const lines = content.split('\n');
        let mm;
        while ((mm = TEST_BODY_RE.exec(content)) !== null) {
          const id = mm[2];
          const title = mm[1];
          const bodyStart = content.slice(0, mm.index).split('\n').length;
          const body = mm[3];
          const bodyLines = body.split('\n');
          for (let i = 0; i < bodyLines.length; i++) {
            const m = bodyLines[i].match(/\/\/\s*AMBIGUOUS_DOC:\s*(.+)/i);
            if (!m) continue;
            const note = m[1].trim();
            // 신뢰도 추출
            const conf = note.match(/신뢰도\s*(\d+)%/);
            const confidence = conf ? parseInt(conf[1], 10) : null;
            // reason vs interpretation 분리 (— 기준)
            const dashIdx = note.indexOf(' — ');
            const reason = dashIdx >= 0 ? note.slice(0, dashIdx).trim() : note;
            const interpretation = dashIdx >= 0 ? note.slice(dashIdx + 3).trim() : '';
            items.push({
              id,
              title,
              note,
              reason,
              interpretation,
              confidence,
              file: relative(root, path),
              line: bodyStart + i,
            });
          }
        }
        TEST_BODY_RE.lastIndex = 0;
      }
    }
  }
  walk(specDir);
  return items;
}

// ── 카테고리 분류 ───────────────────────────────────────────────────
function categorize(item) {
  const r = item.reason.toLowerCase();
  const n = item.note;

  if (/storage state|환경 의존|환경 의존성/.test(n)) return 'env';
  if (/사전조건|사전 데이터|픽스처|fixture/.test(n)) return 'precondition';
  if (/비어있음/.test(item.reason) || /비어있음/.test(n)) return 'empty';
  if (/^docs\s+["'"".+["'""]/.test(item.reason) || /docs\s+["'""]/.test(item.reason)) return 'quote';
  if (/disabled|새창|탭전환|클릭이/.test(n)) return 'ui';
  return 'other';
}

const CAT_LABEL = {
  empty: 'docs 기대 결과 비어있음',
  quote: 'docs 원문 인용 (표현 모호)',
  env: '환경/storage state 의존',
  precondition: '사전 데이터/픽스처 필요',
  ui: 'UI 동작 명세 모호',
  other: '기타',
};

// ── 신뢰도 등급 ─────────────────────────────────────────────────────
function tier(conf) {
  if (conf === null) return 'T?';
  if (conf >= 75) return 'T1';
  if (conf >= 60) return 'T2';
  return 'T3';
}

const TIER_LABEL = {
  T1: 'T1 (75%+) — 해석 신뢰 가능',
  T2: 'T2 (60~70%) — 해석 검토 필요',
  T3: 'T3 (≤55%) — 신뢰 낮음',
  'T?': 'T? — 신뢰도 미표기',
};

// ── 모듈 추출 ───────────────────────────────────────────────────────
function moduleOf(id) {
  const m = id.match(/^(HOME-TA|HOME-TP|[A-Z]+)/);
  return m ? m[1] : '?';
}

// ── 실행 ──────────────────────────────────────────────────────────────
const docsExpected = loadDocsExpected(resolve(root, 'docs/qa'));
const items = collectItems(resolve(root, 'tests/qa'));

if (items.length === 0) {
  console.log('AMBIGUOUS_DOC 항목이 없습니다.');
  process.exit(0);
}

// 그룹핑
const byCatTier = new Map();
for (const it of items) {
  it.cat = categorize(it);
  it.tier = tier(it.confidence);
  it.module = moduleOf(it.id);
  it.docsExpected = docsExpected[it.id] ?? '(매핑 없음)';
  const key = `${it.cat}::${it.tier}`;
  if (!byCatTier.has(key)) byCatTier.set(key, []);
  byCatTier.get(key).push(it);
}

// 출력
console.log('# AMBIGUOUS_DOC 일괄 리뷰 리포트');
console.log('');
console.log(`생성: ${new Date().toISOString()}`);
console.log(`전체: **${items.length}건**`);
console.log('');
console.log('---');
console.log('');

// 요약 표
console.log('## 요약 — 카테고리 × 신뢰도');
console.log('');
const cats = ['empty', 'quote', 'env', 'precondition', 'ui', 'other'];
const tiers = ['T1', 'T2', 'T3', 'T?'];
console.log(`| 카테고리 | T1 (75%+) | T2 (60~70%) | T3 (≤55%) | T? | 합계 |`);
console.log(`| --- | ---: | ---: | ---: | ---: | ---: |`);
for (const c of cats) {
  const counts = tiers.map((t) => (byCatTier.get(`${c}::${t}`)?.length ?? 0));
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) continue;
  console.log(`| ${CAT_LABEL[c]} | ${counts[0]} | ${counts[1]} | ${counts[2]} | ${counts[3]} | **${total}** |`);
}
const tierTotals = tiers.map((t) => items.filter((i) => i.tier === t).length);
console.log(`| **합계** | **${tierTotals[0]}** | **${tierTotals[1]}** | **${tierTotals[2]}** | **${tierTotals[3]}** | **${items.length}** |`);
console.log('');

// 모듈 분포
console.log('## 모듈 분포');
console.log('');
const byModule = new Map();
for (const it of items) byModule.set(it.module, (byModule.get(it.module) ?? 0) + 1);
const sortedMods = [...byModule.entries()].sort((a, b) => b[1] - a[1]);
console.log(`| 모듈 | 건수 |`);
console.log(`| --- | ---: |`);
for (const [m, c] of sortedMods) console.log(`| ${m} | ${c} |`);
console.log('');

// 결정 옵션 가이드
console.log('## 결정 옵션 (그룹별 일괄 적용)');
console.log('');
console.log('각 그룹별로 다음 중 선택:');
console.log('- **A) 강한 단언 보강** — AI 해석이 맞으면 spec에 강한 단언 추가, AMBIGUOUS_DOC 마크 제거');
console.log('- **B) docs 명확화 요청** — anchor 팀에 docs 갱신 요청 (anchor v2 작성 시 반영 가능)');
console.log('- **C) [B] BLOCKED 확정** — `test.skip` + reason="docs 부족" — 신서비스 v2에서 재검토');
console.log('- **D) 케이스별** — 위 일괄 적용 부적합, 항목별 개별 결정');
console.log('');
console.log('---');
console.log('');

// 상세 그룹
console.log('## 상세 (카테고리 × 신뢰도 정렬)');
console.log('');

for (const c of cats) {
  for (const t of tiers) {
    const list = byCatTier.get(`${c}::${t}`);
    if (!list || list.length === 0) continue;
    console.log(`### [${c.toUpperCase()}/${t}] ${CAT_LABEL[c]} — ${TIER_LABEL[t]} (${list.length}건)`);
    console.log('');
    console.log(`**판단**: A / B / C / D`);
    console.log('');
    console.log(`| TC ID | 모듈 | docs 기대 | AI 해석 | 신뢰도 | 위치 |`);
    console.log(`| --- | --- | --- | --- | ---: | --- |`);
    for (const it of list) {
      const docsBrief = (it.docsExpected || '(없음)').replace(/\|/g, '\\|').slice(0, 60);
      const interpretBrief = (it.interpretation || it.reason).replace(/\|/g, '\\|').replace(/\(신뢰도.*\)/, '').trim().slice(0, 80);
      const conf = it.confidence !== null ? `${it.confidence}%` : '-';
      console.log(`| ${it.id} | ${it.module} | ${docsBrief} | ${interpretBrief} | ${conf} | ${it.file}:${it.line} |`);
    }
    console.log('');
  }
}

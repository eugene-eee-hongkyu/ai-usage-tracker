#!/usr/bin/env node
/**
 * ⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
 * consumer repo로 카피된 후엔 직접 수정하지 마세요.
 * 변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
 */

/**
 * sample-verify.mjs
 * VERIFY 코멘트 항목 중 사람 검증이 필요한 것을 위험 점수 기반으로 추출.
 *
 * 사용:
 *   node scripts/sample-verify.mjs --modules=EI,EO,GO --top=12 --random=3
 *   node scripts/sample-verify.mjs                          (모든 모듈, top=12 random=3 기본)
 *   node scripts/sample-verify.mjs --exclude-from=docs/verify-samples-2026-05-05.md
 *   node scripts/sample-verify.mjs --exclude-from=a.md,b.md --exclude-ids=MY-1-12,EI-0-06
 *
 * 출력: 검증자 친화 markdown — docs 기대 + 코드 + 위험 신호 + AI 해석 + Y/N/부분
 *
 * 위험 점수 (Tier 1):
 *   +5 AMBIGUOUS_DOC 동반
 *   +4 광범위 셀렉터 (.first(), getByRole(role).first())
 *   +3 fallback 비율 높음 (try/catch + body.toBeVisible)
 *   +3 도메인 복잡 키워드 (search/filter/sort/match in title)
 *   +2 정규식 hasText 패턴 (getByText(/.../i))
 *   +2 단일 expect 단언만
 *   +2 좌표 계산 (boundingBox)
 *   +1 광역 selector (page.locator without testid)
 *
 * Tier 3: 위험 점수 0인 항목에서 무작위 보충 (false negative 안전망).
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

// ── CLI 파싱 ─────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.+)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);
const moduleFilter = args.modules ? new Set(args.modules.split(',').map(m => m.toUpperCase())) : null;
const TOP_N    = parseInt(args.top    ?? '12', 10);
const RANDOM_N = parseInt(args.random ?? '3',  10);
const excludeFromFiles = args['exclude-from'] ? args['exclude-from'].split(',') : [];
const excludeIdsArg    = args['exclude-ids']  ? new Set(args['exclude-ids'].split(',')) : new Set();

// ── 기존 샘플 파일에서 ID 추출 (제외 대상) ─────────────────────────────
function loadExcludedIds(files) {
  const excluded = new Set();
  const sampleHeaderRe = /^##\s*\[샘플\s+\d+\/\d+\]\s+([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)/gm;
  for (const file of files) {
    const path = resolve(root, file);
    if (!existsSync(path)) {
      console.error(`경고: exclude-from 파일 없음: ${file}`);
      continue;
    }
    const content = readFileSync(path, 'utf-8');
    let m;
    sampleHeaderRe.lastIndex = 0;
    while ((m = sampleHeaderRe.exec(content)) !== null) {
      excluded.add(m[1]);
    }
  }
  return excluded;
}

const excludeIds = new Set([...excludeIdsArg, ...loadExcludedIds(excludeFromFiles)]);

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
      // 헤더에서 "기대 결과" 컬럼 위치 찾기
      if (line.includes('기대 결과') && line.includes('|')) {
        const headers = line.split('|').map(s => s.trim());
        expectedColIdx = headers.findIndex(h => h === '기대 결과');
        continue;
      }
      // TC 행에서 기대 결과 추출
      if (expectedColIdx !== null && line.startsWith('|')) {
        const cells = line.split('|').map(s => s.trim());
        const id = cells[1]?.replace(/^~~|~~$/g, '');
        if (id && TC_ID.test(id) && cells[expectedColIdx]) {
          map[id] = cells[expectedColIdx];
        }
      }
    }
  }
  return map;
}

// ── VERIFY 항목 수집 + 위험 점수 ─────────────────────────────────────
function collectVerifyItems(specDir) {
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
          const title = mm[1];
          const id    = mm[2];
          const body  = mm[3];

          if (moduleFilter) {
            const mod = id.match(/^(HOME-TA|HOME-TP|[A-Z]+)/)?.[1];
            if (!mod || !moduleFilter.has(mod)) continue;
          }

          // body 내 VERIFY 코멘트 찾기
          const bodyLines = body.split('\n');
          for (let i = 0; i < bodyLines.length; i++) {
            const m = bodyLines[i].match(/\/\/\s*VERIFY\s+([a-z-]+)\s*:\s*(.+)/i);
            if (!m) continue;
            const keyword = m[1].toLowerCase();
            const description = m[2].trim();

            // 다음 1~3줄 단언 추출
            const assertion = bodyLines.slice(i + 1, i + 4)
              .find(l => /expect\s*\(|toBe\w+/.test(l)) ?? '';

            // 위험 점수 계산
            const score = computeRisk({ title, body, description, keyword, assertion });

            // 코드 발췌 (VERIFY 앞뒤 ±3줄)
            const startLine = Math.max(0, i - 3);
            const endLine   = Math.min(bodyLines.length, i + 4);
            const codeExcerpt = bodyLines.slice(startLine, endLine).join('\n');

            items.push({
              id, title, keyword, description,
              assertion: assertion.trim(),
              codeExcerpt,
              score,
              riskSignals: getRiskSignals({ title, body, description, keyword, assertion }),
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

// ── 위험 점수 알고리즘 ─────────────────────────────────────────────
function computeRisk({ title, body, description, keyword, assertion }) {
  let score = 0;

  if (/AMBIGUOUS_DOC/i.test(body)) score += 5;
  if (/AMBIGUOUS_VERIFY/i.test(body)) score += 5;
  if (/\.first\(\)|:first-of-type|getByRole\([^)]+\)\.first\(\)/.test(assertion)) score += 4;

  // fallback 비율
  const tryCount = (body.match(/try\s*\{/g) ?? []).length;
  const bodyOnlyCount = (body.match(/expect\s*\(\s*page\.locator\(\s*['"]body['"]\s*\)\s*\)\.toBeVisible/g) ?? []).length;
  if (tryCount > 0 && bodyOnlyCount >= 2) score += 3;

  // 도메인 복잡 키워드 (테스트 제목에서)
  if (/검색|필터|정렬|매칭|결과/.test(title)) score += 3;

  // 정규식 hasText 패턴
  if (/getByText\s*\(\s*\//.test(body)) score += 2;

  // 단일 expect만
  const expectCount = (body.match(/\bexpect\s*\(/g) ?? []).length;
  if (expectCount === 1) score += 2;

  // 좌표 계산
  if (/boundingBox|\.x\b|\.y\b/.test(body)) score += 2;

  // 광역 selector (testid 없는 page.locator)
  if (/page\.locator\(\s*['"](?!.*data-testid)[^'"]+['"]\)/.test(assertion)) score += 1;

  return score;
}

function getRiskSignals({ title, body, description, keyword, assertion }) {
  const signals = [];
  if (/AMBIGUOUS_DOC/i.test(body)) signals.push('AMBIGUOUS_DOC');
  if (/\.first\(\)/.test(assertion)) signals.push('광범위 셀렉터 (.first())');
  if (/getByText\s*\(\s*\//.test(body)) signals.push('정규식 hasText');
  if (/boundingBox/.test(body)) signals.push('좌표 계산');
  if (/검색|필터|정렬|매칭/.test(title)) signals.push('도메인 복잡');
  const tryCount = (body.match(/try\s*\{/g) ?? []).length;
  const bodyOnly = (body.match(/expect\s*\(\s*page\.locator\(\s*['"]body['"]/g) ?? []).length;
  if (tryCount > 0 && bodyOnly >= 2) signals.push('fallback 비율 높음');
  return signals;
}

// ── 샘플 선택: Tier 1 (top N) + Tier 3 (random M) ────────────────────
function selectSamples(items, topN, randomN) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const tier1 = sorted.slice(0, topN);
  const tier1Ids = new Set(tier1.map(i => i.id));
  const remaining = items.filter(i => !tier1Ids.has(i.id));

  // 랜덤 선택 (안전망 — 위험 점수 0인 것 우선)
  const lowRisk = remaining.filter(i => i.score === 0);
  const pool = lowRisk.length >= randomN ? lowRisk : remaining;
  const tier3 = [];
  const poolCopy = [...pool];
  for (let i = 0; i < randomN && poolCopy.length > 0; i++) {
    const idx = Math.floor(Math.random() * poolCopy.length);
    tier3.push(poolCopy.splice(idx, 1)[0]);
  }
  return { tier1, tier3 };
}

// ── 출력 포맷 ────────────────────────────────────────────────────────
function formatSample(item, idx, total, tier, docsExpected) {
  const expected = docsExpected[item.id] ?? '(docs 기대 결과 매핑 없음)';
  const signals = item.riskSignals.length > 0 ? item.riskSignals.join(', ') : '없음';
  return [
    `## [샘플 ${idx}/${total}] ${item.id} (위험 점수 ${item.score} — ${tier})`,
    '',
    `📄 **docs 기대**: ${expected}`,
    '',
    `🚩 **위험 신호**: ${signals}`,
    '',
    `🔍 **코드**:`,
    '```typescript',
    item.codeExcerpt,
    '```',
    '',
    `💭 **AI VERIFY**: \`${item.keyword}\` — ${item.description}`,
    '',
    `❓ **판단**: Y / N / 부분`,
    '',
    '---',
    '',
  ].join('\n');
}

// ── 실행 ──────────────────────────────────────────────────────────────
const docsExpected = loadDocsExpected(resolve(root, 'docs/qa'));
let items = collectVerifyItems(resolve(root, 'tests/qa'));

if (items.length === 0) {
  console.log('VERIFY 항목이 없습니다.');
  process.exit(0);
}

if (excludeIds.size > 0) {
  const before = items.length;
  items = items.filter(i => !excludeIds.has(i.id));
  console.error(`# 제외: ${excludeIds.size}개 ID (${before - items.length}개 항목 제거 → ${items.length}개 남음)`);
  console.error(`# 제외 ID: ${[...excludeIds].join(', ')}`);
}

const { tier1, tier3 } = selectSamples(items, TOP_N, RANDOM_N);
const total = tier1.length + tier3.length;

console.log(`# VERIFY 샘플링 — 위험 우선순위`);
console.log('');
console.log(`생성: ${new Date().toISOString()}`);
console.log(`모듈: ${moduleFilter ? [...moduleFilter].join(', ') : '(전체)'}`);
console.log(`샘플: ${tier1.length} (Tier 1 위험) + ${tier3.length} (Tier 3 랜덤) = ${total}건`);
console.log(`전체 VERIFY 항목 수: ${items.length}`);
console.log('');
console.log('---');
console.log('');

let idx = 1;
for (const item of tier1) {
  console.log(formatSample(item, idx++, total, 'Tier 1', docsExpected));
}
for (const item of tier3) {
  console.log(formatSample(item, idx++, total, 'Tier 3', docsExpected));
}

console.log('## 검토 안내');
console.log('');
console.log('각 항목의 VERIFY description이 docs 기대 + 코드 의도와 일치하는지:');
console.log('- **Y**: description 정확');
console.log('- **N**: description 부정확 또는 코드 검증 부족');
console.log('- **부분**: 방향은 맞지만 좁다/넓다');

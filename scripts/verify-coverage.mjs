#!/usr/bin/env node
/**
 * ⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
 * consumer repo로 카피된 후엔 직접 수정하지 마세요.
 * 변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
 */

/**
 * verify-coverage.mjs
 * docs/qa 활성 TC-ID vs tests/qa spec TC-ID 1:1 대조
 *
 * 사용: node scripts/verify-coverage.mjs
 *       npm run verify:coverage
 *
 * 종료 코드:
 *   0 — 누락 없음
 *   1 — 누락 있음 (CI/커밋 전 차단용)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root   = resolve(__dir, '..');

// ── 1. docs/qa에서 TC-ID 수집 ─────────────────────────────────────────────────
// 활성 TC: | AUTH-1-01 | ...  (첫 번째 셀이 ID 형식)
// 삭제 TC: | ~~AUTH-1-04~~ | ... (취소선 처리됨)

const TC_ID_RE      = /^[A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*$/;
const ACTIVE_ROW_RE = /^\|\s*([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\s*\|/;
const DELETED_ROW_RE = /^\|\s*~~([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)~~\s*\|/;

function collectDocsTcIds(docsDir) {
  const active  = new Set();
  const deleted = new Set();

  if (!existsSync(docsDir)) {
    console.error(`❌ docs/qa 디렉토리를 찾을 수 없음: ${docsDir}`);
    process.exit(1);
  }

  for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const lines = readFileSync(join(docsDir, entry.name), 'utf-8').split('\n');
    for (const line of lines) {
      const del = line.match(DELETED_ROW_RE);
      if (del) { deleted.add(del[1]); continue; }
      const act = line.match(ACTIVE_ROW_RE);
      if (act && TC_ID_RE.test(act[1])) active.add(act[1]);
    }
  }

  return { active, deleted };
}

// ── 2. tests/qa에서 TC-ID 수집 ────────────────────────────────────────────────
// test('[ID]...') 또는 test.skip('[ID]...')

const SPEC_TC_RE = /test(?:\.skip)?\s*\(\s*['"](\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\][^'"]*)['"]/g;

// 한 test() 블록의 본문을 추출 — fake-pass 검출용
const TEST_BODY_RE = /\btest\s*\(\s*['"](\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\][^'"]+)['"][^{]*\{([\s\S]*?)\n\s{2,4}\}\s*\)\s*;/g;

// VERIFY 키워드 → 매칭 단언 패턴
const VERIFY_KEYWORD_MAP = {
  'count':         /toHaveCount|\.toBe\s*\(\s*\d+\s*\)/,
  'count-change':  /toBeLessThan|toBeGreaterThan|toBeLessThanOrEqual|toBeGreaterThanOrEqual|\.toBe\s*\(\s*\w+/,
  'text':          /toHaveText|toContainText/,
  'visible':       /toBeVisible/,
  'hidden':        /toBeHidden|not\.toBeVisible/,
  'url':           /toHaveURL/,
  'attr':          /toHaveAttribute/,
  'value':         /toHaveValue/,
  'enabled':       /toBeEnabled/,
  'disabled':      /toBeDisabled/,
};

function detectVerifyMismatch(body, testId) {
  const lines = body.split('\n');
  const mismatches = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\/\/\s*VERIFY\s+([a-z-]+)\s*:\s*(.+)/i);
    if (!m) continue;
    const keyword = m[1].toLowerCase();
    const desc = m[2].trim();
    if (!(keyword in VERIFY_KEYWORD_MAP)) {
      mismatches.push({ id: testId, keyword, desc, reason: 'unknown-keyword' });
      continue;
    }
    let assertion = '';
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const line = lines[j];
      if (/\/\/\s*VERIFY\s+/i.test(line)) break;
      if (/expect\s*\(|toBeLessThan|toBeGreaterThan|\.toBe\s*\(/.test(line)) {
        assertion = line.trim();
        break;
      }
    }
    if (!assertion) {
      mismatches.push({ id: testId, keyword, desc, reason: 'no-assertion-after' });
      continue;
    }
    if (!VERIFY_KEYWORD_MAP[keyword].test(assertion)) {
      mismatches.push({ id: testId, keyword, desc, assertion: assertion.slice(0, 80), reason: 'keyword-mismatch' });
    }
  }
  return mismatches;
}

function collectSpecTcIds(specDir) {
  const ids = new Set();
  const manualItems = [];        // [M]
  const blockedItems = [];       // [B]
  const deprecatedItems = [];    // [D]
  const activeTests = [];        // test() — fake-pass 검출용
  const ambiguousItems = [];     // // AMBIGUOUS_DOC: 코멘트 — 모호 docs 검토 대상
  const verifyMismatches = [];   // // VERIFY <keyword>: 정합성 깨진 항목
  const navShortcuts = [];       // page.goto + 사용자 동작 키워드 mismatch (의심)

  function reasonAfter(lines, i, prefix) {
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const cm = lines[j].match(new RegExp(`\\/\\/\\s*${prefix}:\\s*(.+)`, 'i'));
      if (cm) return cm[1].trim();
      if (lines[j].includes('});')) break;
    }
    return '';
  }

  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.spec.ts')) {
        const content = readFileSync(full, 'utf-8');
        const lines = content.split('\n');
        let m;
        while ((m = SPEC_TC_RE.exec(content)) !== null) ids.add(m[2]);
        SPEC_TC_RE.lastIndex = 0;

        // 태그별 항목 수집 ([M]/[B]/[D])
        for (let i = 0; i < lines.length; i++) {
          const tagMatch = lines[i].match(/test\.skip\s*\(\s*['"](\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\](\[M\]|\[B\]|\[D\])[^'"]*)['"]/);
          if (!tagMatch) continue;
          const id = tagMatch[2];
          const tag = tagMatch[3];
          if (tag === '[M]') manualItems.push({ id, reason: reasonAfter(lines, i, 'MANUAL') });
          else if (tag === '[B]') blockedItems.push({ id, reason: reasonAfter(lines, i, 'BLOCKED') });
          else if (tag === '[D]') deprecatedItems.push({ id, reason: reasonAfter(lines, i, 'DEPRECATED') });
        }

        // active test() — fake-pass 검출용 단언 추출 + AMBIGUOUS_DOC 마크 검출
        let mm;
        while ((mm = TEST_BODY_RE.exec(content)) !== null) {
          const body = mm[3];
          const expects = (body.match(/\bexpect\s*\([^)]+\)[^;]*/g) ?? []).map(s => s.trim());
          activeTests.push({ id: mm[2], expects });
          // AMBIGUOUS_DOC 마크 검출 — body 내부의 코멘트
          const ambig = body.match(/\/\/\s*AMBIGUOUS_DOC:\s*([^\n]+)/i);
          if (ambig) ambiguousItems.push({ id: mm[2], note: ambig[1].trim() });
          // VERIFY 정합성 검사
          const vm = detectVerifyMismatch(body, mm[2]);
          for (const item of vm) verifyMismatches.push(item);
          // navigation shortcut 검출 — docs는 사용자 동작 요구하나 page.goto만 사용
          const ns = detectNavShortcut(mm[1], body, mm[2]);
          if (ns) navShortcuts.push(ns);
        }
        TEST_BODY_RE.lastIndex = 0;
      }
    }
  }

  walk(specDir);
  return { ids, manualItems, blockedItems, deprecatedItems, activeTests, ambiguousItems, verifyMismatches, navShortcuts };
}

// navigation shortcut 검출 — 명시적 동작 동사("X 클릭/선택/탭")가 테스트 제목에 있는데
// 코드는 page.goto만 호출하고 .click()이 없으면 의심.
// "진입", "표시" 같은 일반 키워드는 제외 — page.goto가 정당한 경우(시작 페이지)
// 휴리스틱이라 false positive 가능 — 의심 카테고리로만 표시.
function detectNavShortcut(title, body, testId) {
  // 명백한 사용자 동작 동사 (page.goto로 우회 시 검증 의도와 mismatch)
  const userAction = /\b(클릭|탭한다|탭 |선택|선택한다)\b|버튼\s+탭|메뉴\s+탭|GNB\s+(메뉴|선택|클릭)/i.test(title);
  const hasGoto    = /\bpage\.goto\s*\(/.test(body);
  const hasClick   = /\.click\s*\(|dispatchEvent\s*\(/.test(body);
  if (userAction && hasGoto && !hasClick) {
    return { id: testId, title: title.slice(0, 60), reason: 'user-action-but-no-click' };
  }
  return null;
}

// ── 화이트리스트 ─────────────────────────────────────────────────────
// phase2-code-generation.md와 동기화. 사유가 화이트리스트에 부합하지 않으면 audit 경고.

const MANUAL_WHITELIST = [
  /본인.*인증|OAuth|SMS|PASS|KMC|소셜.*로그인/i,
  /PG.*결제|실거래|실결제|카드.*결제|계좌.*차감/i,
  /PDF.*시각|PDF.*렌더|PDF.*잘림|PDF.*그래프|이미지.*시각|픽셀/i,
  /외부.*시스템|환경.*의존|외부.*응답.*변동|관리자.*승인|승인.*필요/i,
  /CAPTCHA|봇.*차단|사람.*입력/i,
];

const BLOCKED_WHITELIST = [
  /UI.*미출시|UI.*미구현|기능.*미배포|관련.*미구현|출시.*대기|릴리즈.*대기/i,
  /의존.*기능.*미배포|선행.*UI.*필요/i,
  /QA.*시트.*부족|도메인.*정답.*없음|비교.*데이터.*없음/i,
];

const DEPRECATED_WHITELIST = [
  /요구사항.*변경|기능.*제거|기능.*삭제|정책.*변경|진입점.*제거|UI.*제거/i,
  /구조.*변경|미사용|deprecated/i,
  /옵션.*제거|필터.*단순화|흐름.*변경|안내.*제거|단계.*제거/i,
  /필드.*제거|영역.*제거|버튼.*제거|메뉴.*제거|화면.*제거|진입.*제거/i,
];

function matches(whitelist, reason) {
  if (!reason) return false;
  return whitelist.some(re => re.test(reason));
}

// ── Fake PASS 검출 ───────────────────────────────────────────────────
// 단언이 body.toBeVisible() 또는 toHaveURL 단독이면 의심.
// docs 기대 결과를 검증하지 않는 약한 PASS는 리포트 신뢰도를 떨어뜨림.

function isFakePassExpect(expr) {
  return /expect\s*\(\s*page\.locator\(\s*['"]body['"]\s*\)\s*\)\.toBeVisible/.test(expr) ||
         /expect\s*\(\s*page\s*\)\.toHaveURL/.test(expr);
}

function detectFakePass(activeTest) {
  const expects = activeTest.expects;
  if (!expects.length) return { kind: 'no-assert', detail: '단언 0개' };
  // 모든 단언이 fake-pass 패턴이면 의심
  const allFake = expects.every(isFakePassExpect);
  if (!allFake) return null;
  return { kind: 'body-only', detail: `단언 ${expects.length}개 모두 body/url만` };
}

// ── 3. 대조 ───────────────────────────────────────────────────────────────────

const auditMode = process.argv.includes('--audit');

const { active: docIds, deleted: deletedIds } = collectDocsTcIds(resolve(root, 'docs/qa'));
const { ids: specIds, manualItems, blockedItems, deprecatedItems, activeTests, ambiguousItems, verifyMismatches, navShortcuts } = collectSpecTcIds(resolve(root, 'tests/qa'));

// docs 활성 TC 중 spec에 없는 것 → 누락
const missing = [...docIds].filter(id => !specIds.has(id)).sort();
// spec에 있는데 docs 활성/삭제 어디에도 없는 것 → 의심 항목
const unknown = [...specIds].filter(id => !docIds.has(id) && !deletedIds.has(id)).sort();

// ── 4. 모듈별 그룹화 헬퍼 ────────────────────────────────────────────────────

function groupByModule(ids) {
  const map = {};
  for (const id of ids) {
    const mod = id.match(/^(HOME-TA|HOME-TP|[A-Z]+)/)?.[1] ?? '?';
    (map[mod] ??= []).push(id);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

// ── 5. 결과 출력 ──────────────────────────────────────────────────────────────

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  TC 커버리지 검증');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  docs/qa  활성: ${docIds.size}건  삭제됨: ${deletedIds.size}건`);
console.log(`  tests/qa 구현: ${specIds.size}건`);
console.log('');

// audit 모드: [M]/[B]/[D] 사유 화이트리스트 + fake-pass 검출 + 비율 임계치
let auditWarnings = 0;
if (auditMode) {
  const totalActive = docIds.size;
  const THRESHOLD_PCT = 5;

  console.log('━━ AUDIT 모드 ━━\n');

  // 1) [M] 비율 임계치
  const manualPct = totalActive > 0 ? (manualItems.length / totalActive * 100) : 0;
  console.log(`▸ [M] 비율: ${manualItems.length}건 / docs 활성 ${totalActive}건 = ${manualPct.toFixed(1)}% (임계 ${THRESHOLD_PCT}%)`);
  if (manualPct > THRESHOLD_PCT) {
    console.log(`  ⚠️  [M] 비율 초과 — 분류 재검토 필요`);
    auditWarnings++;
  } else {
    console.log(`  ✅ 임계치 이내`);
  }
  console.log('');

  // 2) [M] 사유 화이트리스트
  const suspM = manualItems.filter(it => !matches(MANUAL_WHITELIST, it.reason));
  if (suspM.length > 0) {
    console.log(`▸ [M] 화이트리스트 외 사유 ${suspM.length}건 — 자동화 가능성 재검토:`);
    console.log('   허용: 본인인증 / PG 실거래 / PDF 시각검증 / 외부시스템(관리자 승인) / CAPTCHA');
    for (const it of suspM) console.log(`  ${it.id.padEnd(15)} "${it.reason || '(사유 미기재)'}"`);
    console.log('   → automation-patterns.md 참고 후 재분류\n');
    auditWarnings += suspM.length;
  } else {
    console.log('▸ [M] 사유 화이트리스트 부합 ✅\n');
  }

  // 3) [B] 사유 화이트리스트
  const suspB = blockedItems.filter(it => !matches(BLOCKED_WHITELIST, it.reason));
  if (suspB.length > 0) {
    console.log(`▸ [B] 화이트리스트 외 사유 ${suspB.length}건 — 의도 불명확:`);
    console.log('   허용: UI 미출시 / 기능 미배포 / 출시 대기');
    for (const it of suspB) console.log(`  ${it.id.padEnd(15)} "${it.reason || '(사유 미기재)'}"`);
    console.log('');
    auditWarnings += suspB.length;
  } else if (blockedItems.length > 0) {
    console.log(`▸ [B] 사유 화이트리스트 부합 ✅ (${blockedItems.length}건)\n`);
  }

  // 4) [D] 사유 화이트리스트
  const suspD = deprecatedItems.filter(it => !matches(DEPRECATED_WHITELIST, it.reason));
  if (suspD.length > 0) {
    console.log(`▸ [D] 화이트리스트 외 사유 ${suspD.length}건 — 삭제 사유 불명확:`);
    console.log('   허용: 요구사항 변경 / 기능 제거 / 정책 변경 / 진입점 제거');
    for (const it of suspD) console.log(`  ${it.id.padEnd(15)} "${it.reason || '(사유 미기재)'}"`);
    console.log('');
    auditWarnings += suspD.length;
  } else if (deprecatedItems.length > 0) {
    console.log(`▸ [D] 사유 화이트리스트 부합 ✅ (${deprecatedItems.length}건)\n`);
  }

  // 5) Fake PASS 검출 — 단언이 body.toBeVisible() 또는 toHaveURL 단독인 active test
  const fakes = activeTests.map(t => ({ ...t, fake: detectFakePass(t) })).filter(t => t.fake);
  const fakePct = activeTests.length > 0 ? (fakes.length / activeTests.length * 100) : 0;
  console.log(`▸ Fake PASS 검출: ${fakes.length}건 / active test ${activeTests.length}건 = ${fakePct.toFixed(1)}%`);
  if (fakes.length > 0) {
    console.log('   docs 기대 결과 미검증 — body/url 단독 단언만 있는 약한 PASS:');
    const byMod = {};
    for (const f of fakes) {
      const mod = f.id.match(/^(HOME-TA|HOME-TP|[A-Z]+)/)?.[1] ?? '?';
      (byMod[mod] ??= []).push(f.id);
    }
    for (const [mod, list] of Object.entries(byMod).sort()) {
      console.log(`  ${mod.padEnd(10)} (${String(list.length).padStart(3)}건)  ${list.slice(0, 5).join(', ')}${list.length > 5 ? ` ... +${list.length - 5}` : ''}`);
    }
    console.log('   → automation-patterns.md / phase2-code-generation.md §단언 패턴 카탈로그 참고\n');
    auditWarnings += fakes.length;
  } else {
    console.log('   ✅ 모든 active test가 docs 기대 결과 단언 보유\n');
  }

  // 6) docs 모호 의심 — AMBIGUOUS_DOC 마크 + [B] docs 모호 사유
  const docAmbiguousBlocked = blockedItems.filter(it => /docs.*모호|명확화.*필요|기대결과.*모호/i.test(it.reason));
  const totalAmbiguous = ambiguousItems.length + docAmbiguousBlocked.length;
  if (totalAmbiguous > 0) {
    console.log(`▸ docs 모호 의심 ${totalAmbiguous}건 — Eugene 일괄 리뷰 대상`);
    if (ambiguousItems.length > 0) {
      console.log(`  🟡 AMBIGUOUS_DOC 마크 ${ambiguousItems.length}건 (AI 해석 + 검토 필요):`);
      for (const it of ambiguousItems.slice(0, 10)) {
        console.log(`    ${it.id.padEnd(15)} "${it.note.slice(0, 80)}"`);
      }
      if (ambiguousItems.length > 10) console.log(`    ... +${ambiguousItems.length - 10}건`);
    }
    if (docAmbiguousBlocked.length > 0) {
      console.log(`  🔵 [B] docs 모호 ${docAmbiguousBlocked.length}건 (anchor 팀 명확화 필요):`);
      for (const it of docAmbiguousBlocked.slice(0, 10)) {
        console.log(`    ${it.id.padEnd(15)} "${(it.reason || '').slice(0, 80)}"`);
      }
      if (docAmbiguousBlocked.length > 10) console.log(`    ... +${docAmbiguousBlocked.length - 10}건`);
    }
    console.log('   → 리포트 모호 섹션에서 일괄 결정 (Full QA는 끊김 없이 끝까지)\n');
  } else {
    console.log('▸ docs 모호 의심 없음 ✅\n');
  }

  // 7) VERIFY 정합성 검사 — 키워드와 단언 매칭
  if (verifyMismatches.length > 0) {
    console.log(`▸ VERIFY 정합성 깨진 ${verifyMismatches.length}건 — AMBIGUOUS_VERIFY 의심`);
    const byReason = { 'unknown-keyword': [], 'no-assertion-after': [], 'keyword-mismatch': [] };
    for (const it of verifyMismatches) (byReason[it.reason] ??= []).push(it);
    if (byReason['unknown-keyword'].length > 0) {
      console.log(`  ⚠️  알 수 없는 키워드 ${byReason['unknown-keyword'].length}건 (표준 셋: count/count-change/text/visible/hidden/url/attr/value/enabled/disabled):`);
      for (const it of byReason['unknown-keyword'].slice(0, 5)) {
        console.log(`    ${it.id.padEnd(15)} VERIFY ${it.keyword}: "${it.desc.slice(0, 60)}"`);
      }
    }
    if (byReason['no-assertion-after'].length > 0) {
      console.log(`  ⚠️  VERIFY 직후 단언 없음 ${byReason['no-assertion-after'].length}건:`);
      for (const it of byReason['no-assertion-after'].slice(0, 5)) {
        console.log(`    ${it.id.padEnd(15)} VERIFY ${it.keyword}: "${it.desc.slice(0, 60)}"`);
      }
    }
    if (byReason['keyword-mismatch'].length > 0) {
      console.log(`  ⚠️  키워드↔단언 불일치 ${byReason['keyword-mismatch'].length}건:`);
      for (const it of byReason['keyword-mismatch'].slice(0, 5)) {
        console.log(`    ${it.id.padEnd(15)} VERIFY ${it.keyword}: "${it.desc.slice(0, 40)}"`);
        console.log(`    ${' '.repeat(15)}   → 단언: ${it.assertion}`);
      }
    }
    console.log('   → phase2-code-generation.md §VERIFY 코멘트 컨벤션 참고\n');
    auditWarnings += verifyMismatches.length;
  } else {
    console.log('▸ VERIFY 정합성 ✅ (불일치 0건)\n');
  }

  // 8) navigation shortcut 의심 — page.goto + 사용자 동작 키워드 mismatch (휴리스틱)
  if (navShortcuts.length > 0) {
    console.log(`▸ navigation shortcut 의심 ${navShortcuts.length}건 — 사용자 동작 우회 가능성`);
    for (const it of navShortcuts.slice(0, 8)) {
      console.log(`  ⚠️  ${it.id.padEnd(15)} "${it.title}"`);
    }
    if (navShortcuts.length > 8) console.log(`  ... +${navShortcuts.length - 8}건`);
    console.log('   → automation-patterns.md §12 사용자 동작 시뮬레이션 우선 참고');
    console.log('   → 휴리스틱이므로 false positive 가능. 사람 검토 후 수정.\n');
  } else {
    console.log('▸ navigation shortcut ✅ (의심 0건)\n');
  }

  // 9) 에이전트 위임 시 안전장치 알림 (D)
  console.log('▸ 에이전트 위임 결과는 위 모든 항목이 0건이어야 머지 허용 (phase2 §위임 프로토콜)');
  console.log('');
}

if (missing.length === 0 && unknown.length === 0 && auditWarnings === 0) {
  console.log('✅ 누락 없음 — 모든 활성 TC가 spec에 존재합니다.\n');
  process.exit(0);
}

if (missing.length === 0 && unknown.length === 0 && auditWarnings > 0) {
  console.log(`⚠️  AUDIT 경고 ${auditWarnings}건 — 누락은 없지만 [M] 분류 재검토 필요\n`);
  process.exit(auditMode ? 1 : 0);
}

if (missing.length > 0) {
  console.log(`❌ 누락 ${missing.length}건 — docs에 있지만 spec에 없음`);
  console.log('   (자동화 불가 → [M], 구현 예정 → test(), 기타 사유 → [S])\n');
  for (const [mod, ids] of groupByModule(missing)) {
    console.log(`  ${mod.padEnd(10)} (${String(ids.length).padStart(2)}건)  ${ids.join(', ')}`);
  }
  console.log('');
}

if (unknown.length > 0) {
  console.log(`⚠️  미확인 ${unknown.length}건 — spec에 있지만 docs에 없음`);
  console.log('   (TC-ID 오타이거나 docs에 추가 필요)\n');
  for (const [mod, ids] of groupByModule(unknown)) {
    console.log(`  ${mod.padEnd(10)} (${String(ids.length).padStart(2)}건)  ${ids.join(', ')}`);
  }
  console.log('');
}

console.log('처리 방법:');
console.log('  자동화 불가  →  test.skip(\'[ID][M] 제목\', async () => { /* MANUAL: 사유 */ })');
console.log('  구현 예정    →  test(\'[ID] 제목\', async ({ page }) => { ... })');
console.log('  스킵         →  test.skip(\'[ID][S] 제목\', async () => { /* SKIP: 사유 */ })');
console.log('');

process.exit(missing.length > 0 ? 1 : 0);

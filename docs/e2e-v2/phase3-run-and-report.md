<!--
⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
consumer repo로 카피된 후엔 직접 수정하지 마세요.
변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
-->

# Phase 3 — 전체 실행 + QA 결과 리포트 생성

> 목표: 전체 tests/qa/ 를 실행하고, QA 문서와 TC-ID별로 매핑된 결과 리포트를 생성한다.
> 산출물: `playwright-report/qa-report.html`
> 예상 소요: 1시간 (실행 40분 + 리포트 생성 20분)

---

## 🚫 핵심 운영 원칙 — Full QA는 끊김 없이 끝까지

```
Full QA 실행 중:
  ❌ 사람 개입 0
  ❌ 결정 대기 0
  ❌ 끊김 0

사람의 일:
  ✅ 시작 전: 룰만 정함 (phase 2.0에서 완료)
  ✅ 끝난 후: 리포트 일괄 리뷰
```

**왜:**
- 271건 보강 중 모호 케이스 50건 가정 → 50번 끊김 = 50번 컨텍스트 스위치
- "5초 결정" × 50 = 실제론 hour 단위 본업 침식
- **결정 피로**: 50번째 결정은 첫 번째보다 정확도 떨어짐

**모호한 docs는 spec 작성 시점에 AI가 자동 분류** (phase2 §모호한 docs 처리):
- 추론 가능 → `// AMBIGUOUS_DOC:` 마크 + 단언
- 추론 불가 → `[B] BLOCKED + 사유 "docs 모호"`

리포트 §04 "docs 모호 의심"에서 일괄 리뷰 → Eugene 30분 일괄 결정 → 다음 사이클 spec에 반영.

---

## ⚠️ 핵심 원칙

리포트에 나타나는 TC-ID 총 수 == 872개 (삭제된 TC 제외)
이 숫자가 맞지 않으면 리포트가 완성된 것이 아니다.

---

## 0. 환경 헬스체크 (필수 선행)

전체 실행 전 5분 헬스체크. **이걸 건너뛰면 staging 다운/storageState 만료/페이지 500 같은 환경 이슈를 수백 건 timeout 형태로 뒤늦게 발견한다.**

### 0-1. storageState 신선도 체크
```bash
ls -la tests/.auth/
# mtime이 12시간 이상 오래됐으면 즉시 재실행
find tests/.auth -name "*.json" -mmin +720 | head -1 && \
  npx playwright test tests/auth.setup.ts --project=setup
```

### 0-2. 페이지 진입 진단 spec

`tests/_diag/page-availability.spec.ts` 같은 파일에 각 모듈의 entry page 진입만 검증하는 1줄 spec을 둔다:

```typescript
import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'MY',      path: '/my-info',                 auth: 'paid-user' },
  { name: 'GO',      path: '/search/active-officials', auth: 'paid-user' },
  { name: 'EO',      path: '/search/former-officials', auth: 'tax-officer' },
  { name: 'ER',      path: '/tax-history-report/me',   auth: 'tax-officer' },
  // ... 11개 모듈 entry
];

for (const p of PAGES) {
  test(`[DIAG-${p.name}] ${p.path} 진입 가능`, async ({ page }) => {
    test.use({ storageState: `tests/.auth/${p.auth}.json` });
    await page.goto(p.path);
    await expect(page.locator('body')).toBeVisible();
    // 500 오류 페이지가 아닌지 명시적 확인
    await expect(page.getByText(/500|서버 오류|Internal Server Error/i)).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });
}
```

```bash
SKIP_AUTH_SETUP=1 npx playwright test tests/_diag/page-availability.spec.ts --project=chromium
```

진단 결과:
- ✅ 모두 PASS → Phase 3 §1 본 실행 진행
- ❌ 일부 PASS / 일부 FAIL → 실패 모듈은 staging 이슈일 가능성. spec의 해당 항목을 `[B]`로 임시 마킹 후 본 실행 (실패 일괄 발생 방지)
- ❌ 모두 FAIL → storageState 만료 또는 staging 다운. 본 실행 금지, 환경 복구 후 재시도

> 💡 진단 spec은 `.gitignore`에 `tests/_diag/` 추가하거나 별도 폴더로 분리해 본 실행에 섞이지 않게 한다.

---

## 0-2. 보강 직후 회귀 검증 (필수)

spec 보강(특히 fake-pass → 강한 단언) 직후엔 반드시 풀 실행 + 회귀 비교:

```bash
# 보강 전 results.json 백업
cp playwright-report/results.json playwright-report/results.prev.json

# 풀 실행
npx playwright test tests/qa/ --project=chromium 2>&1 | tee /tmp/qa-run.log

# 회귀 자동 분석
npm run diff:regression
```

### 회귀 발생 시 판정

| 회귀 비율 | 대응 |
|---|---|
| 0% | ✅ 진행 |
| 1~5% | ⚠️ 검토 — 진짜 깨짐 vs false fail 분류 |
| 5%+ | 🚨 **보강 단언이 가드 부족** — automation-patterns.md §⚡ 가드 결합 패턴 적용 후 재실행 |

> 이번 프로젝트 사례: fake-pass 274 → 0 보강 후 풀 실행 시 회귀 44건 (5.7%). 원인 = 강한 단언만 추가하고 가드 결합 누락. 가이드에 가드 결합 패턴 명문화 후 재보강.

---

## 1. 전체 실행

```bash
# config의 reporter 설정 사용 (권장 — results.json 자동 저장)
npx playwright test tests/qa/ --project=chromium 2>&1 | tee /tmp/qa-run.log
```

- `playwright.config.ts`에 `['json', { outputFile: 'playwright-report/results.json' }]`이 있으면 자동으로 저장됨
- 진행 로그는 `/tmp/qa-run.log`에 실시간 기록 — 다른 터미널에서 `tail -f /tmp/qa-run.log`로 모니터링

### ⚠️ Reporter 함정 — 가장 자주 당하는 실수

> **`--reporter=` cli flag는 `playwright.config.ts`의 `reporter` 배열을 *덮어쓴다*.**
> config의 `outputFile` 설정도 함께 덮여서 results.json이 **stdout으로만 출력**되고 파일에 안 저장된다. 백그라운드 실행에서는 stdout 캡처가 안 되면 **결과를 통째로 잃는다**.

| 실행 형태 | 명령 | 결과 |
|---|---|---|
| ✅ **권장** (config 사용) | `npx playwright test tests/qa/ --project=chromium` | config의 list+html+json 모두 활성, results.json 자동 저장 |
| ⚠️ cli flag로 reporter 명시 | `--reporter=list,json` | config 무시, json은 stdout으로만 — outputFile 누락 |
| ❌ 절대 금지 (백그라운드) | `--reporter=json` | 완료 시점에만 출력, 진행 모니터링 불가 |

818개 TC 전체 실행은 1~2시간 걸린다. config 기본값을 쓰고 cli flag를 생략하는 게 안전.

---

## 2. QA 결과 리포트 생성

```bash
node scripts/generate-qa-report.mjs
```

---

## 리포트 구조

### 메인 페이지 (`playwright-report/qa-report.html`)

상단에 모듈별 요약 표:

| 모듈 | docs/qa 전체 | ✅ PASS | ❌ FAIL | ⏭️ 수동 | 👤 스킵 | 커버리지 |
|---|---|---|---|---|---|---|
| AUTH | 104 | 72 | 3 | 18 | 5 | 91% |
| TA | 65 | 50 | 2 | 11 | 0 | 97% |
| ... | | | | | | |
| **합계** | **872** | **N** | **N** | **N** | **N** | **N%** |

그 아래 모듈별 TC-ID 결과 테이블:

```
## AUTH — 로그인/회원가입

| TC-ID | 테스트명 | 기대결과 (요약) | 결과 | 비고 |
|---|---|---|---|---|
| AUTH-3-01 | 비로그인 홈 접근 | 로그인 페이지 이동 | ✅ PASS | |
| AUTH-4-4-01 | 이메일 로그인 | 홈으로 이동 | ✅ PASS | |
| AUTH-4-4-05 | 5회 틀린 비밀번호 | 계정 잠금 안내 | ❌ FAIL | 잠금 미동작 |
| AUTH-4-6-01 | 신규 회원가입 | — | 👤 스킵 | 사람이 수행 |
| AUTH-4-6-03 | 카카오 소셜 로그인 | — | ⏭️ 수동 | OAuth 팝업 차단 |
```

### 수동 검증 필요 테이블 (페이지 하단 섹션)

TC-ID, 테스트명, 수동 검증 불가 이유, 검증 방법 제안 포함.

### 스킵 목록 테이블 (페이지 하단 섹션)

TC-ID, 테스트명, 스킵 이유 포함.

---

## `generate-qa-report.mjs` 구현 가이드

### TC-ID 파싱 (HOME-TA/HOME-TP 복합 접두어 포함)

```javascript
// ⚠️ HOME-TA, HOME-TP 같은 복합 접두어를 지원하는 정규식
const TC_RE = /^\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d-]+)\](\[M\]|\[S\])?/;

function parseTcId(testTitle) {
  const match = testTitle.match(TC_RE);
  return match ? { id: match[1], tag: match[2] || '' } : null;
}
```

### 수동 vs 스킵 구분

테스트 이름에 `[M]` 또는 `[S]` 태그로 구분:
```typescript
test.skip('[AUTH-4-6-03][M] 카카오 소셜 로그인', ...) // MANUAL → ⏭️ 수동
test.skip('[AUTH-탈퇴-01][S] 계정 완전 탈퇴', ...)     // SKIP   → 👤 스킵
```

### 결과 아이콘 매핑

```javascript
function statusIcon(status, tag) {
  if (status === 'passed') return '✅ PASS';
  if (status === 'failed') return '❌ FAIL';
  if (status === 'skipped') {
    if (tag === '[M]') return '⏭️ 수동';
    if (tag === '[S]') return '👤 스킵';
    return '⏭️ 수동';  // 기본값
  }
  return '⬜ 미실행';
}
```

### spec 파일 파싱 — skip 이유 추출

```javascript
function parseSpecReasons(specDir) {
  const reasons = new Map();
  // test.skip() 바로 다음 줄의 // 주석을 이유로 사용
  // HOME-TA/HOME-TP 복합 접두어 지원
  const RE = /test\.skip\(\s*['"](\[([A-Z][A-Z0-9]*(?:-[A-Z]+)*-[\d][\d-]*)\][^'"]*)['"]/;
  // ...
}
```

---

## package.json 스크립트

```json
"test:qa": "npx playwright test tests/qa/ --project=chromium --reporter=list,json",
"report:qa": "node scripts/generate-qa-report.mjs",
"qa": "npx playwright test tests/qa/ --project=chromium --reporter=list,json && node scripts/generate-qa-report.mjs"
```

---

## ✅ 완료 기준

- [ ] `npx playwright test tests/qa/` 에러 없이 완료
- [ ] `playwright-report/qa-report.html` 생성
- [ ] **리포트의 TC-ID 총 수 == 872개**
- [ ] ❌ FAIL 항목에 에러 메시지 첫 줄 표시
- [ ] 수동 검증 필요 항목 별도 테이블 존재 (이유 포함)
- [ ] 스킵 항목 별도 테이블 존재 (이유 포함)
- [ ] Vercel 배포 완료

---

## 결과 해석 가이드

사람이 리포트를 볼 때 확인할 것:

1. **❌ FAIL 항목** → 버그 후보. 기대결과와 실제 결과 비교해서 버그 여부 판단
2. **⏭️ 수동 항목** → 사람이 직접 검증 필요. 수동 검증 테이블의 방법 참고
3. **👤 스킵 항목** → 사람이 수행 예정. 체크리스트로 활용
4. **✅ PASS 항목** → AI가 자동 검증 완료. 별도 확인 불필요

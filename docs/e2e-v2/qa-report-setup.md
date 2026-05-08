<!--
⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
consumer repo로 카피된 후엔 직접 수정하지 마세요.
변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
-->

# QA 리포트 셋업 가이드

> 이 디자인의 QA 리포트를 새 프로젝트에 적용하는 방법.

---

## 1. 필요한 파일 (5개 복사)

```
scripts/
  generate-qa-report.mjs    # 리포트 생성기 (수정 불필요)
  verify-coverage.mjs        # docs/qa vs spec 1:1 대조 (수정 불필요)
qa-report.config.mjs         # ★ 프로젝트별 설정 — 수정 필요
```

`package.json`에 4줄 추가:
```json
{
  "scripts": {
    "report:qa": "node scripts/generate-qa-report.mjs",
    "verify:coverage": "node scripts/verify-coverage.mjs",
    "verify:coverage:audit": "node scripts/verify-coverage.mjs --audit",
    "diff:regression": "node scripts/diff-regression.mjs"
  }
}
```

추가 복사 파일:
- `scripts/diff-regression.mjs` — 회귀 자동 감지
- `tests/qa/_shared/helpers.ts` — 공통 헬퍼 (모든 spec이 import)

---

## 2. 프로젝트 구조 (스크립트가 가정하는 것)

```
docs/qa/                              # TC-ID 정의 마크다운
  QA_AUTH_*.md                        # 모듈별 1파일
  QA_MY_*.md
  ...
tests/qa/                             # Playwright spec 파일
  auth/auth.spec.ts
  my/my.spec.ts
  ...
playwright-report/                    # Playwright JSON reporter 출력
  results.json
```

### docs/qa 마크다운 형식

TC-ID는 마크다운 표의 첫 번째 셀에 배치. 삭제된 TC는 취소선:
```markdown
| TC-ID      | 분류   | ... |
| ---------- | ----- | --- |
| AUTH-1-01  | 정상   | ... |
| ~~AUTH-1-04~~ | ~~정상~~ | ~~삭제됨~~ |
```

### spec 파일 명명 규칙

```typescript
test('[AUTH-1-01] 일반 자동화 케이스', async ({ page }) => { ... });
test.skip('[AUTH-4-05][M] 본인 인증 — 자동화 불가', async () => { /* MANUAL */ });
test.skip('[AUTH-1-04][D] 요구사항 삭제됨', async () => { /* DEPRECATED */ });
test.skip('[EI-1-31][B] UI 미출시 — 출시 후 자동화 가능', async () => { /* BLOCKED */ });
test.skip('[AUTH-탈퇴-01][S] 위험성으로 스킵', async () => { /* SKIP */ });
```

태그 의미:
- `[M]` MANUAL — 원리적으로 자동화 불가, 사람이 검증해야 하는 영역 (PG 결제, OAuth, SMS, PDF 시각 검증 등)
- `[D]` DEPRECATED — 요구사항 변경으로 서비스에서 제거됨, 테스트 대상에서 공식 제외
- `[B]` BLOCKED — UI 미출시 또는 의존 기능 미배포로 일시 비활성화. **출시 후 자동화 가능**
- `[S]` SKIP — 정책상 자동 실행 제외 (회원 탈퇴 등 위험)

**[M] vs [B] 판단 기준**:
- `[M]`: 영구적으로 사람이 해야 함 (자동화 도구 한계)
- `[B]`: UI/기능 출시되면 자동화 가능 (현재 일시 대기)

---

## 3. qa-report.config.mjs 작성

```js
export default {
  brand: {
    name: 'YourProject',         // Topbar/Footer 브랜드명
    subtitle: 'QA Report',
    initial: 'Y',                // 좌상단 마크 글자
  },
  modules: [
    { id: 'AUTH', label: '로그인 / 회원가입' },
    { id: 'USER', label: '사용자 관리' },
    // ... TC-ID prefix와 일치하는 id 사용
    // 순서가 리포트 표시 순서
  ],
  links: {
    e2e: './index.html',                // Playwright HTML 리포트
    playwright: './detail/index.html',  // Playwright 상세 리포트
  },
};
```

`modules[].id`는 docs/qa 파일과 spec 파일의 TC-ID prefix와 정확히 일치해야 합니다. 예:
- TC-ID `AUTH-1-01` → `id: 'AUTH'`
- TC-ID `HOME-TP-1-05` → `id: 'HOME-TP'` (복합 prefix)

---

## 4. 실행 흐름

```bash
# 1) 테스트 실행 (Playwright JSON reporter 활성화 필요)
npx playwright test tests/qa/ --reporter=list,json | tee /tmp/run.log

# 2) 커버리지 검증 — docs/qa 활성 TC가 모두 spec에 있는지 확인
npm run verify:coverage
#   → 누락 0건이어야 다음 단계 진행 가능

# 3) (권장) AUDIT 모드 — [M] 분류 품질 검사
npm run verify:coverage:audit
#   → [M] 비율 5% 초과 또는 화이트리스트 외 사유 발견 시 경고
#   → 자동화 가능한 항목이 [M]으로 잘못 분류된 것을 잡아냄

# 4) 리포트 생성
npm run report:qa
#   → playwright-report/qa-report.html 생성

# 5) 배포 (선택)
vercel deploy playwright-report --prod
```

---

## 5. Playwright 설정 (필수)

`playwright.config.ts`에 JSON reporter 추가:
```typescript
export default defineConfig({
  reporter: [
    ['list'],
    ['html',  { outputFolder: 'playwright-report/detail', open: 'never' }],
    ['json',  { outputFile:  'playwright-report/results.json' }],
  ],
});
```

---

## 6. 결과 분류 로직

리포트는 각 TC를 6가지로 분류:

| 분류 | 조건 |
|---|---|
| **PASS** | spec에 `test()`로 작성, results.json에서 `passed` |
| **FAIL** | spec에 `test()`로 작성, results.json에서 `failed`/`timedOut`/`interrupted` |
| **삭제(D)** | spec에 `test.skip('[ID][D]...')` |
| **대기(B)** | spec에 `test.skip('[ID][B]...')` — UI 미출시, 출시 후 자동화 가능 |
| **수동(M)** | spec에 `test.skip('[ID][M]...')` — 원리적 자동화 불가 |
| **스킵(S)** | spec에 `test.skip('[ID][S]...')` 또는 런타임 조건부 skip |

`DOCS_TOTAL`은 docs/qa의 활성+삭제 TC를 모두 합산해서 계산.

---

## 7. 흔한 문제

| 증상 | 원인 / 해결 |
|---|---|
| 커버리지가 100% 초과 | spec에 docs에 없는 TC-ID가 있음. `verify:coverage` 결과의 "미확인" 섹션 확인 |
| 모듈이 리포트에 안 나옴 | `qa-report.config.mjs`의 `modules` 배열에 누락. id가 prefix와 일치하는지 확인 |
| TC-ID가 파싱 안 됨 | spec 제목 `[ID]` 직후가 `[M]/[D]/[S]` 또는 공백이어야 함. 언더스코어 등 사용 금지 |
| 실패 메시지에 ANSI 코드 | `cleanAnsi()`가 자동 제거. 더 이상한 코드는 정규식 보강 필요 |

---

## 8. 다음 프로젝트로 가져갈 때 체크리스트

- [ ] `scripts/generate-qa-report.mjs` 복사
- [ ] `scripts/verify-coverage.mjs` 복사
- [ ] `qa-report.config.mjs` 작성 (brand + modules + links)
- [ ] `package.json`에 `report:qa` / `verify:coverage` 스크립트 추가
- [ ] `playwright.config.ts`에 JSON reporter 설정
- [ ] docs/qa 형식 준수 (TC-ID 첫 셀, 삭제는 취소선)
- [ ] spec 파일 `[ID][M/D/S]` 태그 컨벤션 준수
- [ ] `npm run verify:coverage` 통과 확인
- [ ] `npm run verify:coverage:audit` 실행 → [M] 분류 경고 점검
- [ ] [M] 분류 의심 항목은 `docs/anchor-e2e-v2/automation-patterns.md` 참고하여 재검토
- [ ] `npm run report:qa` 실행

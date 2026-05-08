<!--
⚠️ 이 파일은 e2e-framework v3.2 에서 관리됩니다.
consumer repo로 카피된 후엔 직접 수정하지 마세요.
변경 필요 시: e2e-framework repo에 PR → consumer 재카피.
-->

# Playwright 자동화 패턴 모음

> [M] 처리 전에 이 문서를 먼저 확인한다.
> "어려워 보임" 사유 대부분은 아래 패턴으로 해결된다.

---

## ⚡ 핵심 원칙 — 강한 단언 + 가드 결합

> **단언 강도와 가드는 양자택일이 아니다. 항상 결합한다.**

이번 프로젝트 회귀 44건의 교훈:
- fake-pass 제거를 위해 강한 단언으로 보강
- 그러나 **가드 없이 강한 단언만**은 staging 변동성에 false fail
- "선택자 미발견" → 강한 단언이 timeout / not visible로 깨짐

### ✅ 올바른 패턴 — 가드 + 강한 단언 결합

```typescript
test('[X-1-01] 검색 결과 행 노출', async ({ page }) => {
  await page.goto('/search');
  const submitBtn = page.getByRole('button', { name: '검색' });

  // 가드: 진입 자체가 막혔을 수 있음 (권한·staging 다운 등)
  if (!(await isVisibleSoft(submitBtn, 5000))) {
    await expect(page.locator('body')).toBeVisible();
    return;
  }

  await submitBtn.click();

  // 강한 단언: docs 기대 결과 검증
  const rows = page.locator('[role="row"], tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 8000 });
});
```

### ❌ 잘못된 패턴 1 — 가드 없는 강한 단언

```typescript
// staging UI 변경 시 false fail
await submitBtn.click();
await expect(rows.first()).toBeVisible();
```

### ❌ 잘못된 패턴 2 — 가드만 있고 단언 없음 (Fake PASS)

```typescript
if (await isVisibleSoft(submitBtn)) await safeClick(submitBtn);
await expect(page.locator('body')).toBeVisible(); // ← Fake PASS
```

### 판정 기준 — 진짜 fail vs false fail

회귀가 발생했을 때:
| 신호 | 판정 |
|---|---|
| 다른 모듈에서 같은 selector가 PASS | **false fail** — 가드 부족 |
| timeout 60s — 페이지 진입 자체 안 됨 | **환경 이슈** — staging 또는 권한 |
| "expected received" — 값은 받았는데 다름 | **진짜 fail 또는 데이터 변경** |
| 첫 시도 PASS → 다음 시도 FAIL | **flaky** — 가드 강화 필요 |

→ **false fail이면 가드 추가**, true fail이면 [B] BLOCKED 또는 docs 명확화.

---

## 0. SPA Navigation — 가장 중요 ⚠️

**과거 244건 실패의 가장 큰 원인이 이 패턴 미적용이었다.** SPA에서 `page.goto('/deep-url')`을 직접 치면 라우터가 홈(`/`)으로 redirect하는 경우가 많다. spec 작성자가 이 동작을 모르면 **deep page에 진입하지 못한 채 selector를 찾으려다 timeout**으로 실패한다.

### 잘못된 패턴 (❌)

```typescript
// 직접 deep URL 진입 — SPA에서 홈으로 redirect됨
await page.goto('/my-info');
await expect(page.getByText('내 정보')).toBeVisible();  // 홈에 있는 단어 우연 매치 또는 timeout
```

### 올바른 패턴 (✅)

```typescript
// 홈 진입 → GNB 클릭 → 페이지 로드 대기
async function navigateTo(page: Page, gnbLabel: string) {
  await page.goto('/');
  const menu = page.getByText(gnbLabel).first();
  if (await menu.isVisible({ timeout: 5000 })) {
    await menu.dispatchEvent('click');  // 일부 GNB는 normal click 실패 — dispatchEvent 권장
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  }
}

await navigateTo(page, '내 정보');
await expect(page.getByTestId('myinfo-name-label').first()).toBeVisible();
```

### 판단 기준

- **모든 deep URL 테스트는 GNB 경로로 진입**해야 한다는 가정으로 시작
- 직접 URL 진입이 가능한지는 **PoC 단계(phase 2.0)에서 1번 검증**한다 (아래 §10 참고)
- 직접 진입이 가능하면 사용해도 되지만, 안 되는 페이지가 1개라도 있으면 모든 spec에 GNB 패턴 강제

---

## 1. PDF / 파일 다운로드

`page.waitForEvent('download')`로 다운로드 트리거 자체를 자동화 검증한다.
시각 검증(잘림·그래프·픽셀)은 자동화 불가지만, **다운로드 발생 여부**는 자동화 가능.

```typescript
test('[ER-1-05] PDF 저장 버튼 — 다운로드 발생', async ({ page }) => {
  await page.goto('/tax-history-report/me');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF 저장' }).click(),
  ]);

  // 파일명·확장자 검증
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});
```

**[M] 처리 부분만 분리**: 위와 별도로 PDF 내용 시각 검증은 `[M]`으로 남겨둔다.

---

## 2. 자동완성 드롭다운

"불안정"하다는 이유로 [M] 처리하지 말 것. 적절한 `waitFor` + `getByRole('option')` 패턴으로 안정 자동화 가능.

```typescript
test('[HOME-TA-1-31] 세무법인명 자동완성', async ({ page }) => {
  const input = page.getByPlaceholder('세무법인명');
  await input.fill('한국');

  const option = page.getByRole('option', { name: /한국세무법인/ });
  await option.waitFor({ state: 'visible', timeout: 5000 });
  await option.click();

  await expect(input).toHaveValue(/한국/);
});
```

**드롭다운이 안 뜨는 UI 버그가 있다면**: 이건 `[B]` (UI 버그 수정 후 자동화). `[M]`이 아님.

---

## 3. 결제 페이지 — UI 표시만 검증

PG 실거래는 [M]이지만, **결제 페이지 진입 + 버튼 상태 + 목록 표시**는 자동화 가능.

```typescript
test('[SP-1-23] 결제 수단 추가 버튼 비활성화', async ({ page }) => {
  await page.goto('/membership/payment');
  const addBtn = page.getByRole('button', { name: '결제 수단 추가' });

  // 무료 구독자는 비활성화 상태
  await expect(addBtn).toBeDisabled();
});

test('[SP-1-22] 결제 내역 페이지네이션 10건씩', async ({ page }) => {
  await page.goto('/membership/history');
  const rows = page.getByRole('row');
  await expect(rows).toHaveCount(10 + 1); // 헤더 1줄 포함
});
```

**판단**: "PG 결제 자동화 불가"라는 큰 룰을 모든 SP TC에 적용하지 말 것. 각 TC가 실제로 검증하려는 게 무엇인지 본다.

---

## 4. 본인인증 — 인증 전 단계까지

본인인증 팝업 자체는 [M]이지만, **인증 모달 진입 + 입력 필드 상태**는 자동화 가능.

```typescript
test('[AUTH-6-04-1] 본인 인증 모달 진입', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: '본인 인증하기' }).click();

  // PASS/KMC 팝업이 떠야 함
  const popup = page.getByRole('dialog', { name: /본인 인증/ });
  await expect(popup).toBeVisible();
  // 팝업 내부 인증 진행은 [M]으로 남김
});
```

---

## 5. 파일 업로드 — 업로드 트리거까지

`setInputFiles()`로 파일 업로드 자동화 가능. 단, **관리자 승인 결과 확인**은 [M].

```typescript
test('[EI-1-08] 자격증 파일 업로드', async ({ page }) => {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('tests/fixtures/sample-cert.pdf');

  await expect(page.getByText(/업로드 완료/)).toBeVisible();
  // 관리자 승인 결과는 [M]으로 별도 분리
});
```

---

## 6. 외부 새 창 / popup

`context.waitForEvent('page')`로 새 창 자동화 가능.

```typescript
test('[AUTH-2-02] 새 창에서 멤버십 상세 표시', async ({ page, context }) => {
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('link', { name: '세무사/세무법인 멤버십' }).click(),
  ]);
  await newPage.waitForLoadState();
  await expect(newPage).toHaveURL(/membership.*tax/);
});
```

---

## 7. 네트워크 응답 검증

API 응답을 직접 가로채서 데이터 변경 없이 검증.

```typescript
test('[GO-1-04] 검색 결과 API 응답 검증', async ({ page }) => {
  const response = page.waitForResponse(/\/api\/officials\/search/);
  await page.getByRole('button', { name: '검색' }).click();
  const res = await response;
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.items).toBeInstanceOf(Array);
});
```

---

## 8. 시각 회귀 (스크린샷 비교)

특정 컴포넌트의 렌더링 결과를 픽셀 단위로 비교 — 시각 검증을 자동화하는 한 가지 방법.

```typescript
test('[VR-1] 세무법인 랭킹 카드 시각 검증', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('ranking-card');
  await expect(card).toHaveScreenshot('ranking-card.png');
});
```

PDF처럼 완전 시각 검증이 필요한 경우에도, 베이스라인을 한 번 확정해두면 회귀는 자동 검증 가능.

---

## 9. 권한 / 역할별 진입 차단

다른 storageState로 같은 페이지를 접속해 차단·진입을 검증.

```typescript
test.use({ storageState: 'tests/.auth/free-user.json' });
test('[GO-0-01] 무료 계정 — 접근 차단 화면', async ({ page }) => {
  await page.goto('/search/active-officials');
  await expect(page.getByText(/구독|업그레이드/)).toBeVisible();
});
```

---

## 10. `<select>` selectOption — 명시적 타임아웃 필수

**문제:** `selectOption({ index: N })` 기본 타임아웃은 **30초**. 옵션이 비어있거나 늦게 로딩되면 30s 대기 → 후속 작업과 합쳐 60s 테스트 타임아웃 초과.

**증상:** 단독 모듈 테스트는 PASS, 풀테스트에서 timeout FAIL. 가드 try/catch가 있어도 30s는 그대로 소비됨.

**잘못된 패턴:**
```typescript
// ❌ 타임아웃 누락 → 옵션 없으면 30s 대기
try {
  await comboboxes.first().selectOption({ index: 1 });
} catch { /* ignore */ }
```

**올바른 패턴:**
```typescript
// ✅ 명시적 타임아웃 (3초)
try {
  await comboboxes.first().selectOption({ index: 1 }, { timeout: 3000 });
} catch { /* ignore */ }
```

**한 테스트에 selectOption 여러 번 호출 시:** 누적 타임아웃 = N × 3s 가 60s 안에 들어가는지 계산. 안 들어가면 isVisibleSoft 가드를 selectOption 앞에 두고 옵션 존재 확인 후 호출.

```typescript
// 콤보박스 3개를 순차 선택할 때
for (let i = 0; i < 3; i++) {
  if (await isVisibleSoft(comboboxes.nth(i), 1000)) {
    try { await comboboxes.nth(i).selectOption({ index: 1 }, { timeout: 3000 }); } catch {}
  }
}
```

**검색 후 페이지 전환 가능 시 단언도 fallback:**
```typescript
// 제출 후 홈 그리팅이 사라질 수 있음 — body fallback
try {
  await expect(page.getByTestId('home-search-greeting')).toBeVisible({ timeout: 3000 });
} catch {
  await expect(page.locator('body')).toBeVisible();
}
```

> 이 패턴은 HOME-TA 4건 + HOME-TP 7건이 풀테스트에서만 깨졌던 회귀를 일괄 해소했음 (`3162ae2`).

---

## 11. End-to-end action chain — 흐름의 일부만 검증 금지

**문제:** docs는 "X 액션 → Y 결과"의 한 흐름을 요구하지만, AI는 흔히 "X 액션 단계만" 또는 "Y 결과 일부만" 검증한다. 이게 **새로운 fake-pass 통로** — `body.toBeVisible()` 단독은 audit가 잡지만, 흐름의 일부만 검증한 PASS는 audit가 못 잡는다.

**잘못된 예시 (입력만 검증, 저장·반영 미검증):**
```typescript
test('[MY-1-12] 주소 변경 모달 — 도로명주소 선택 후 변경 완료', async () => {
  // ❌ 검색 입력만 하고 끝
  await searchInput.fill('서울 강남');
  await expect(searchInput).toHaveValue(/서울 강남/);
  // 변경 버튼 클릭, 모달 닫힘, 주소 반영은 미검증
});
```

**올바른 예시 (액션 전체 흐름 검증):**
```typescript
test('[MY-1-12] 주소 변경 모달 — 도로명주소 선택 후 변경 완료', async () => {
  await searchInput.fill('서울 강남');
  // VERIFY value: 검색 입력 반영 (1단계)
  await expect(searchInput).toHaveValue(/서울 강남/);

  // 결과 선택 + 변경 버튼 클릭
  const result = page.getByRole('option').first();
  await result.click();
  await page.getByRole('button', { name: /변경|적용/ }).click();

  // VERIFY hidden: 모달 닫힘 (2단계)
  await expect(modalSearch).not.toBeVisible({ timeout: 5000 });
  // VERIFY text: 변경된 주소가 페이지에 반영 (3단계 = docs 기대 결과)
  await expect(addressDisplay).toContainText('서울 강남');
});
```

**체크리스트 — VERIFY 작성 시:**
- [ ] docs 기대 결과의 **마지막 단계까지** 검증하는가?
- [ ] "X 클릭 → Y 발생"인 docs를 "X 클릭만" 또는 "Y 일부만"으로 줄이지 않았는가?
- [ ] 다이얼로그/모달 닫힘이 docs 의도라면 닫힘 + 후속 상태 둘 다 검증했는가?

**패턴 적용 사례:**
- 이메일 변경: 입력 → 인증 메일 전송 → 인증번호 필드 노출 (입력만 검증 금지)
- 주소 변경: 입력 → 결과 선택 → 변경 버튼 → 모달 닫힘 → 페이지 반영
- 구독 해지: 해지 클릭 → 다이얼로그 → 확인 클릭 → 구독 상태 변경 (다이얼로그 닫힘만 검증 금지)
- 멤버 검색 + 초기화: 입력 → 초기화 → 빈 값 (입력만 검증 금지)

---

## 12. 사용자 동작 시뮬레이션 우선 — `page.goto()` 편법 금지

**문제:** docs가 "GNB > X 클릭"인데 AI는 흔히 `page.goto('/x-page')`로 SPA 네비게이션을 우회한다. URL이 맞으면 PASS는 되지만 **실제 사용자 동작 (GNB 클릭) 검증이 빠짐**. 이건 SPA 라우팅·이벤트 핸들러 버그를 못 잡는 새 fake-pass 통로.

**잘못된 예시 (URL goto 편법):**
```typescript
test('[AUTH-1-05] 세무사 찾기 선택 — 비로그인 세무사 검색 화면 이동', async () => {
  // ❌ 실제 클릭 흐름 우회
  await page.goto('/search/tax-experts');
  await expect(page).toHaveURL(/\/search\/tax-experts/);
});
```

**올바른 예시 (실제 GNB 클릭):**
```typescript
test('[AUTH-1-05] 세무사 찾기 선택 — 비로그인 세무사 검색 화면 이동', async () => {
  await page.goto('/');                          // 진입점만 goto
  await page.getByText('세무사 찾기').first().click();  // 실제 사용자 동작
  // VERIFY url: 클릭 후 검색 페이지로 이동
  await expect(page).toHaveURL(/\/search\/tax-experts/);
});
```

**`page.goto()`가 정당한 경우:**
- 진입점 (홈 `/`, 로그인 페이지 등) — 시나리오 시작
- 사전 조건 설정 (테스트 본 의도 외 페이지)
- staging URL 직접 전이 검증 (deep link 케이스 명시)

**`page.goto()`가 함정인 경우:**
- docs가 "GNB > X 클릭" 또는 "메뉴 X 선택"이라고 명시
- 사용자 인터랙션을 시뮬레이션해야 하는 경우
- 라우팅 트리거 검증이 docs 의도

**체크리스트 — VERIFY 작성 시:**
- [ ] docs가 "X 클릭"이라고 명시했는데 코드는 `page.goto`만 하지 않았는가?
- [ ] 진입점 외에 navigation을 검증해야 한다면 실제 클릭으로 했는가?

> audit 룰 후보: `page.goto` + docs에 "클릭/선택/탭" 키워드 mismatch 시 의심 표시.

---

## 13. 닫힌 메뉴/드롭다운 활성화 후 검증 — 닫힌 상태 검증은 fake-pass

**문제:** GNB 메뉴, 드롭다운, 사이드바, 모달 트리거 등 **닫힌 상태로 시작하는 UI**는 활성화하지 않으면 그 안의 항목 자체가 DOM에 없거나 hidden. 이 상태에서 `getByText('X').toHaveCount(0)`은 항상 PASS — 실제로 X가 미노출 정책이라서가 아니라 **메뉴가 안 열렸기 때문**. 이건 audit가 못 잡는 새 fake-pass 통로.

**잘못된 예시 (GNB 안 열고 메뉴 검색):**
```typescript
test('[EI-0-06] 비세무사 — "세무 이력 관리" 메뉴 미노출', async () => {
  await page.goto('/');
  // ❌ GNB 메뉴는 닫힌 상태. "세무 이력 관리"는 어차피 GNB 안에 있어 항상 0건
  await expect(page.getByText('세무 이력 관리')).toHaveCount(0);
});
```

**올바른 예시 (활성화 후 검증):**
```typescript
test('[EI-0-06] 비세무사 — "세무 이력 관리" 메뉴 미노출', async () => {
  await page.goto('/');
  const opened = await openGnb(page);  // GNB 메뉴 토글 클릭
  if (!opened) {
    await expect(page.locator('body')).toBeVisible();
    return;
  }
  // ✅ GNB 활성화 후 메뉴 항목 검증 (권한별 분기 진짜 검증)
  await expect(page.getByRole('menuitem', { name: /세무 이력 관리/ })).toHaveCount(0);
});
```

**적용 대상 UI 종류:**
- GNB 프로필/햄버거 메뉴 (활성화 액션: profile-btn 클릭)
- 검색 필터 드롭다운 (활성화 액션: select 클릭)
- 사이드바/네비 토글 (활성화 액션: 토글 클릭)
- 모달 트리거 (활성화 액션: 트리거 버튼 클릭)
- Tooltip/Popover (활성화 액션: 호버 또는 클릭)

**체크리스트 — VERIFY 작성 시:**
- [ ] 검증 대상이 닫힌 상태 UI 안에 있는데 활성화 액션 누락하지 않았는가?
- [ ] `getByText` / `toHaveCount(0)` 검증이 실제로 의미 있는 비교인가, 단순히 메뉴가 안 열려서 0건인가?
- [ ] 권한별 분기 검증 시 모든 권한에 대해 동일하게 활성화 → 검증 패턴 적용했는가?

**helper 강제화:** `tests/qa/_shared/helpers.ts`에 공통 활성화 헬퍼(`openGnb()`, `openSelect()` 등) 정의. 모듈에서 직접 `getByTestId('gnb-profile-btn').click()` 호출 금지 → 헬퍼 통해 일관 처리.

---

## 자동화 불가가 진짜 맞는 케이스 (`[M]` 정당)

아래는 **시도해도 정말 안 되는** 영역. 이런 경우만 `[M]`:

| 영역 | 사유 |
|---|---|
| OAuth 소셜 로그인 (카카오/구글/페이스북) | 외부 OAuth provider 팝업, IP/디바이스 검증 |
| SMS / KMC / PASS 본인인증 | 실제 휴대폰 SMS 또는 PASS 앱 인증 필요 |
| PG 실거래 (카드 결제 완료) | 실제 카드 차감, 테스트 결제 환경 없을 때 |
| PDF 내용 시각 검증 | "잘림", "그래프 모양", 픽셀 단위 정확성 |
| CAPTCHA | reCAPTCHA 등 봇 차단 |
| 안심번호 / 익명 처리 | 외부 서비스의 마스킹 결과 검증 |

---

## 셀프 체크리스트

[M] 처리 전에 아래를 확인:

- [ ] 위 9개 패턴 중 하나로 해결되는가?
- [ ] TC를 더 좁은 검증 범위로 쪼갤 수 있는가?
- [ ] 자동화 시도를 실제로 해봤는가? (코드 작성·실행)
- [ ] [M] 사유가 위 "정당한 [M]" 표 6개 중 하나인가?
- [ ] [B] (UI 미출시)로 분류해야 할 항목은 아닌가?

**모두 No이면 → 자동화 시도. Yes이면 → [M].**

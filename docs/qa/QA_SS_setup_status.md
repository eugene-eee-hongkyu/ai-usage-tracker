# [SS] 셋업 상태 — QA 테스트케이스

## 1. 문서 개요

| 항목 | 내용 |
| --- | --- |
| 대상 기능 | 셋업 상태 (ready / in-progress / stale 24h+) + fetchError + step 3종 + 트러블슈팅 details 4종 + cli 명령 복사 |
| 기획 문서 (A-2) | [docs/03_A-2_프로세스를_화면으로_사용량대시보드_v6.md §2 #8](../03_A-2_프로세스를_화면으로_사용량대시보드_v6.md) |
| C-1 brief | [§1 `/api/setup/status` · §3 #8 행 4개 · §4-5 `✅ 정상 작동 중`/`⚙️ 셋업 진행 중`/`⚠️ 수집이 멈췄을 수 있어요` · §4-6 stale 24*60분 · §5-2 #8 status-* testid](../C-1.qa-implementation-brief.md) |
| 대상 앱 | 공통 |
| 작성일 | 2026-05-08 |

## 2. 공통 사전조건

| 조건 | 상세 (C-1 페르소나 ID) |
| --- | --- |
| 테스트 환경 | 로컬 dev (`http://localhost:3000`) |
| 기본 계정 | P2 (정상 일반) — C-1 §2 |
| 필요 데이터 | `psql < db/seed/P2.sql` ([C-1 §2](../C-1.qa-implementation-brief.md)) |

## 3. 접근 권한 테스트

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| SS-0-01 | 권한 | (비로그인) — C-1 §2 P1 변형 | 1. session 쿠키 없이 `page.goto('/setup-status')` | URL 이 `/login?callbackUrl=%2Fsetup-status` 패턴으로 변경 — `/api/setup/status` 401 ([route.ts:10](../../web/src/app/api/setup/status/route.ts#L10)) | |

## 4. 화면별 테스트

### 4-1. `/setup-status` — A-2 §2 #8 / C-1 페르소나 P1·P2·P5

#### 정상 동작

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| SS-1-01 | 정상 | P2 (정상 일반, lastSyncedAt=NOW(), sessionsCount≥1) — C-1 §2 | 1. `page.goto('/setup-status')` | `[data-testid="status-overall"]` 텍스트가 `✅ 정상 작동 중` 포함 (C-1 §4-5, [setup-status/page.tsx:96~102](../../web/src/app/setup-status/page.tsx#L96)) + `[data-testid="status-stale-warning"]` count=0 (lastSyncedAt 신선) | C-1 §3 #8 첫 행 "자동" |
| SS-1-02 | 정상 | P1 (신규, lastSyncedAt=null, sessionsCount=0) — C-1 §2 | 1. P1 시드 후 `page.goto('/setup-status')` | `[data-testid="status-overall"]` 텍스트가 `⚙️ 셋업 진행 중` 포함 (C-1 §4-5, [setup-status/page.tsx:96~102](../../web/src/app/setup-status/page.tsx#L96)) | |
| SS-1-03 | 정상 | P5 (lastSyncedAt = NOW() - 8일) — C-1 §2 | 1. P5 시드 후 `page.goto('/setup-status')` | `[data-testid="status-stale-warning"]` 1 visible + 텍스트 `⚠️ 수집이 멈췄을 수 있어요` 포함 (C-1 §4-5, [setup-status/page.tsx:111](../../web/src/app/setup-status/page.tsx#L111)) | C-1 §4-6 stale 임계 24*60 분 (= 24h) — 8일은 통과 |
| SS-1-04 | 정상 | P2 — C-1 §2 | 1. `page.goto('/setup-status')` | `[data-testid="status-step-cli"]` + `status-step-hook` + `status-step-first-session` 모두 visible (3 step row) ([setup-status/page.tsx:130,146,159](../../web/src/app/setup-status/page.tsx#L130)) | |

#### 데이터 검증

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| SS-1-05 | 데이터 | P2 + `context.grantPermissions(['clipboard-read','clipboard-write'])` | 1. `page.goto('/setup-status')` 2. `[data-testid="status-copy-cli"]` 클릭 3. `page.evaluate(()=>navigator.clipboard.readText())` | clipboard 텍스트가 정확히 `npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker init` (C-1 §4-5 #2 sync 명령 동일 패턴, [setup-status/page.tsx:138](../../web/src/app/setup-status/page.tsx#L138)) | |
| SS-1-06 | 데이터 | P5 — C-1 §2 | 1. `page.goto('/setup-status')` 2. `[data-testid="status-stale-warning"]` text content 인용 | C-1 §4-5 정확 utf-8 문자열 일치 — `⚠️ 수집이 멈췄을 수 있어요` (이모지 포함, [setup-status/page.tsx:111](../../web/src/app/setup-status/page.tsx#L111)) | |
| SS-1-07 | 데이터 | P5 — C-1 §2, lastSyncedAt = NOW() - 23h | 1. `page.goto('/setup-status')` | `[data-testid="status-stale-warning"]` count=0 (23h < 24*60 분 임계, [setup-status/page.tsx:80](../../web/src/app/setup-status/page.tsx#L80)) | boundary -1h |
| SS-1-08 | 데이터 | P5 — C-1 §2, lastSyncedAt = NOW() - 25h | 1. `page.goto('/setup-status')` | `[data-testid="status-stale-warning"]` 1 visible (25h > 24*60 분 임계) | boundary +1h |

#### 엣지케이스

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| SS-1-09 | 엣지 | P2 + `page.route('**/api/setup/status',r=>r.fulfill({status:500,body:'{}'}))` | 1. `page.goto('/setup-status')` 2. 1초 대기 | `[data-testid="status-fetch-error"]` 1 visible + `[data-testid="status-retry"]` 1 visible ([setup-status/page.tsx:53,60](../../web/src/app/setup-status/page.tsx#L53)) | C-1 §3 #8 둘째 행 "자동" |
| SS-1-10 | 엣지 | P2 (SS-1-09 진행 후 unroute) — C-1 §2 | 1. SS-1-09 진입 2. `page.unroute('**/api/setup/status')` 3. `[data-testid="status-retry"]` 클릭 4. `page.waitForResponse('**/api/setup/status')` | 응답 status=200 + `[data-testid="status-fetch-error"]` count=0 + `[data-testid="status-overall"]` 1 visible (C-1 §1 `/api/setup/status` 200 회복) | |
| SS-1-11 | 엣지 | P2 — C-1 §2 | 1. `page.goto('/setup-status')` 2. `[data-testid="status-faq-no-data"]` 의 `<details>` 클릭 (`details.open=true`) | `[data-testid="status-faq-no-data"]` 의 `details[open]` selector 매치 ([setup-status/page.tsx:176~221](../../web/src/app/setup-status/page.tsx#L176)) | C-1 §3 #8 셋째 행 "자동" |
| SS-1-12 | 엣지 | P2 — C-1 §2 | 1. `page.goto('/setup-status')` 2. `[data-testid="status-faq-reset-key"]` `<details>` 클릭 | `[data-testid="status-faq-reset-key"][open]` 매치 | |
| SS-1-13 | 엣지 | P2 — C-1 §2 | 1. `page.goto('/setup-status')` 2. `[data-testid="status-faq-backfill"]` `<details>` 클릭 | `[data-testid="status-faq-backfill"][open]` 매치 | |
| SS-1-14 | 엣지 | P2 — C-1 §2 | 1. `page.goto('/setup-status')` 2. `[data-testid="status-faq-win-hook"]` `<details>` 클릭 | `[data-testid="status-faq-win-hook"][open]` 매치 | |

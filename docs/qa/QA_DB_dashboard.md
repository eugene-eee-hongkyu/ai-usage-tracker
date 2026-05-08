# [DB] 대시보드 (공유 컴포넌트) — QA 테스트케이스

> DashboardView 단일 컴포넌트가 `/dashboard` (#3, 본인) / `/team/[userId]/dashboard` (#6, admin viewOnly) / `/member` (#7, admin selector) 3 라우트 공유. 본 문서는 라우트별 사전조건 분기로 통합 — 룰 [16] 재사용 컴포넌트 1 모듈.

## 1. 문서 개요

| 항목 | 내용 |
| --- | --- |
| 대상 기능 | DashboardView (Period tab + Snapshot dropdown + 6 row + 효율 6 메트릭 + 활동/체류 heatmap + visit/dwell + tz picker + sync-needed + fetchError) |
| 기획 문서 (A-2) | [§2 #3 #6 #7 + §4 #3](../03_A-2_프로세스를_화면으로_사용량대시보드_v6.md) |
| C-1 brief | [§1 `/api/dashboard` `/api/visit` `/api/visit-end` `/api/user/timezone` · §3 #3 행 16개 + #6 #7 · §4-1 효율 5단계 · §4-3 heatmap 5단계 · §4-5 모든 #3 텍스트 · §4-6 polling/heatmap/visit cap · §5-2 #3 dash-* testid](../C-1.qa-implementation-brief.md) |
| 대상 앱 | 공통 + admin (#6 #7) |
| 작성일 | 2026-05-08 |

## 2. 공통 사전조건

| 조건 | 상세 (C-1 페르소나 ID) |
| --- | --- |
| 테스트 환경 | 로컬 dev (`http://localhost:3000`) |
| 기본 계정 | P2 (정상-일반, full data 30일+) — C-1 §2 |
| 필요 데이터 | `psql < db/seed/P2.sql` ([C-1 §2 P2](../C-1.qa-implementation-brief.md)) |
| 라우트 분기 | `/dashboard` (본인) · `/team/{P2.userId}/dashboard` (admin viewOnly) · `/member` (admin selector) — 라우트별 사전조건 컬럼에 명시 |

## 3. 접근 권한 테스트

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-0-01 | 권한 | (비로그인) — C-1 §2 P1 변형 | 1. session 없이 `page.goto('/dashboard')` | URL 이 `/login?callbackUrl=%2Fdashboard` 패턴으로 변경 — C-1 §1 `/api/dashboard` 401 ([route.ts:105](../../web/src/app/api/dashboard/route.ts#L105)) | |
| DB-0-02 | 권한 | P1 (신규, lastSyncedAt=null) — C-1 §2 | 1. P1 시드 후 `page.goto('/dashboard')` | URL 이 `/setup` 으로 변경 (`router.push('/setup')`, [dashboard-view.tsx:522](../../web/src/components/dashboard-view.tsx#L522)) | C-1 §2 P1 분기 |
| DB-0-03 | 권한 | P2 (non-admin) — C-1 §2 | 1. `page.goto('/team/10/dashboard')` (자기 자신) | URL 이 `/team/10` 으로 변경 (admin only redirect, [team/[userId]/dashboard/page.tsx:18](../../web/src/app/team/[userId]/dashboard/page.tsx#L18)) | C-1 §3 #6 "자동" |
| DB-0-04 | 권한 | P3 (admin) + P2 멤버 (id=10) — C-1 §2 | 1. `page.goto('/team/10/dashboard')` | URL 변동 없음 (`/team/10/dashboard` 유지) + `[data-testid="dash-overview-bar"]` 1 visible (admin viewOnly 진입 성공) | |
| DB-0-05 | 권한 | P2 (non-admin) — C-1 §2 | 1. `page.goto('/member')` | URL 이 `/team` 또는 `/login` 으로 변경 (admin guard, [member/page.tsx:18](../../web/src/app/member/page.tsx#L18)) | A-2 §2 #7 admin only |
| DB-0-06 | 권한 | P3 admin + P2 멤버 + localStorage `teamMemberSelectedUserId='10'` 사전 주입 | 1. `context.addInitScript(()=>{localStorage.setItem('teamMemberSelectedUserId','10')})` 2. `page.goto('/member')` | `[data-testid="dash-member-select"]` 의 value 정확히 `10` ([member/page.tsx:9](../../web/src/app/member/page.tsx#L9)) + `[data-testid="dash-overview-bar"]` 1 visible | C-1 §3 #7 "자동" |

## 4. 화면별 테스트

### 4-1. Loading / FetchError / Sync needed — A-2 §4 #3 4-d / C-1 페르소나 P1·P2·P7

#### 정상 동작 + 분기

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-01 | 정상 | P2 + `page.route('**/api/dashboard*', delay=1000)` | 1. `page.goto('/dashboard')` 2. 500ms 시점 인용 | `[data-testid="dash-loading"]` 1 visible + 텍스트 정확히 `loading...` (C-1 §4-5, [dashboard-view.tsx:497](../../web/src/components/dashboard-view.tsx#L497)) | |
| DB-1-02 | 데이터 | P2 + `page.route('**/api/dashboard*', r=>r.fulfill({status:500,body:'{}'}))` | 1. `page.goto('/dashboard')` 2. 1초 대기 | `[data-testid="dash-fetch-error"]` 1 visible + 텍스트 `데이터를 불러오지 못했습니다.` 포함 + `[data-testid="dash-retry"]` 1 visible 텍스트 `재시도` (C-1 §4-5, [dashboard-view.tsx:506,515](../../web/src/components/dashboard-view.tsx#L506)) | |
| DB-1-03 | 데이터 | P2 (DB-1-02 진행 후 unroute) — C-1 §2 | 1. `[data-testid="dash-retry"]` 클릭 2. `page.waitForResponse('**/api/dashboard*')` | 응답 status=200 + `[data-testid="dash-fetch-error"]` count=0 (C-1 §1 `/api/dashboard` 200 회복) | |
| DB-1-04 | 데이터 | P7 (lastSyncedAt 5분 전, overview=null) — C-1 §2 P7 | 1. P7 시드 후 `page.goto('/dashboard')` | `[data-testid="dash-sync-needed"]` 1 visible + 텍스트 `sync needed` 포함 + `[data-testid="dash-sync-cmd"]` 텍스트 정확히 `npx github:eugene-eee-hongkyu/ai-usage-tracker sync` (C-1 §4-5, [dashboard-view.tsx:537~555](../../web/src/components/dashboard-view.tsx#L537)) | |
| DB-1-05 | 데이터 | P7 + `context.grantPermissions(['clipboard-read','clipboard-write'])` | 1. `page.goto('/dashboard')` 2. `[data-testid="dash-sync-copy"]` 클릭 3. `page.evaluate(()=>navigator.clipboard.readText())` | clipboard 텍스트가 `[data-testid="dash-sync-cmd"]` 텍스트와 정확히 일치 (C-1 §3 #3 다섯째 행 "부분", [dashboard-view.tsx:549](../../web/src/components/dashboard-view.tsx#L549)) | |
| DB-1-06 | 데이터 | P3 admin + P8 (멤버 데이터 없음) → `/team/{P8.userId}/dashboard` 진입 (admin viewOnly + member 데이터 없음) | 1. `page.goto('/team/12/dashboard')` | `[data-testid="dash-overview-bar"]` 자식 또는 별도 selector 에 텍스트 `아직 데이터가 없습니다.` 포함 (C-1 §4-5, [dashboard-view.tsx:532](../../web/src/components/dashboard-view.tsx#L532)) | viewOnly empty |

### 4-2. Period tab + Snapshot dropdown — C-1 §4-5

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-07 | 정상 | P2 — C-1 §2 | 1. `page.goto('/dashboard')` | 5 testid 모두 visible — `[data-testid="dash-period-today"]` `dash-period-month` `dash-period-8days` `dash-period-30days` `dash-period-all` (C-1 §4-5 `오늘 / 이번달 / 8일 / 30일 / 전체`, [dashboard-view.tsx:573](../../web/src/components/dashboard-view.tsx#L573)) | |
| DB-1-08 | 정상 | P2 — C-1 §2 | 1. `page.goto('/dashboard')` 2. `[data-testid="dash-period-today"]` 클릭 3. `page.waitForResponse(r=>r.url().includes('/api/dashboard?period=today'))` | 1 GET 요청 발생 + 응답 status=200 (C-1 §3 #3 둘째 행 "자동") | |
| DB-1-09 | 정상 | P2 + `period_snapshots` 테이블에 daily(2026-05-07), weekly(2026-04-27), monthly(2026-04-01) 각 1행 — C-1 §2 P2 fixture | 1. `page.goto('/dashboard')` | `[data-testid="dash-day-offset"]` `dash-week-offset` `dash-month-offset` 3 select 모두 visible + 각 select 의 `<option>` 첫 번째 텍스트가 `이전 ▼` 포함 (C-1 §4-5, [dashboard-view.tsx:587,602,616](../../web/src/components/dashboard-view.tsx#L587)) | |
| DB-1-10 | 정상 | DB-1-09 동일 | 1. `[data-testid="dash-day-offset"]` 으로 `어제` option 선택 2. `page.waitForResponse(r=>r.url().includes('dayOffset=1'))` | 1 GET 요청 발생 + 응답 200 + `[data-testid="dash-overview-bar"]` 의 활동 데이터 갱신 (C-1 §3 #3 셋째 행 "자동") | |

### 4-3. Overview bar / Row 카드 12종 — C-1 §5-2 dash-card-*

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-11 | 정상 | P2 — C-1 §2 | 1. `page.goto('/dashboard')` | 12 testid 모두 visible — `[data-testid="dash-card-daily-tokens"]` `dash-card-daily-cost` `dash-card-efficiency` `dash-card-activity-heatmap` `dash-card-by-model` `dash-card-top-sessions` `dash-card-by-project` `dash-card-by-activity` `dash-card-core-tools` `dash-card-shell-cmd` `dash-card-mcp` `dash-card-dwell-heatmap` (C-1 §5-2 #3, [dashboard-view.tsx:699,733,772,918,942,974,1016,1057,1108,1143,1182,1243](../../web/src/components/dashboard-view.tsx#L699)) | C-1 §3 #3 첫 행 "자동" |
| DB-1-12 | 데이터 | P2 (totalCost=423.78) — C-1 §2 | 1. `page.goto('/dashboard')` | `[data-testid="dash-overview-bar"]` 자식에 `$423.78` 또는 `$423` 또는 `423` 텍스트 1 이상 포함 ([dashboard-view.tsx:644](../../web/src/components/dashboard-view.tsx#L644)) | |
| DB-1-13 | 데이터 | P2 + projects 16개 시드 — C-1 §2 변형 | 1. `page.goto('/dashboard')` | `[data-testid="dash-card-by-project"]` 자식 row 가 scroll 가능 영역 (length>15 임계, [dashboard-view.tsx:1019](../../web/src/components/dashboard-view.tsx#L1019)) — 카드 내부에 `overflow` CSS 또는 scroll bar 존재 | C-1 §4-6 list scroll 임계 15 |

### 4-4. 효율 6 메트릭 + 등급 — C-1 §4-1 / §4-2

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-14 | 정상 | P2 (cache=91.4) — C-1 §2 | 1. `page.goto('/dashboard')` | `[data-testid="dash-metric-cache"]` 1 visible + 자식 `[data-testid$="-grade"]` cell BG class `bg-green-500/15` (cache 91 양호, C-1 §4-1·§4-2, [dashboard-view.tsx:879~895](../../web/src/components/dashboard-view.tsx#L879)) | |
| DB-1-15 | 데이터 | P2 변형 (cache=96 탁월) | 1. `page.goto('/dashboard')` | `[data-testid="dash-metric-cache"]` grade BG `bg-emerald-500/15` (≥96 탁월, C-1 §4-2) | boundary 96 |
| DB-1-16 | 데이터 | P2 변형 (cache=59 경고) | 1. `page.goto('/dashboard')` | `[data-testid="dash-metric-cache"]` grade BG `bg-red-500/15` (<60 경고) | boundary <60 |
| DB-1-17 | 데이터 | P2 변형 (oneshot=0.90 탁월) | 1. `page.goto('/dashboard')` | `[data-testid="dash-metric-oneshot"]` grade BG `bg-emerald-500/15` (≥0.90 탁월, C-1 §4-1) | |
| DB-1-18 | 데이터 | P2 변형 (cost/session=9.99 탁월) | 1. `page.goto('/dashboard')` | `[data-testid="dash-metric-cost-session"]` grade BG `bg-emerald-500/15` (<10 탁월) | |
| DB-1-19 | 데이터 | P2 변형 (calls/session=30 탁월) | 1. `page.goto('/dashboard')` | `[data-testid="dash-metric-calls-session"]` grade BG `bg-emerald-500/15` (30~60 탁월) | |
| DB-1-20 | 데이터 | P2 변형 (cost/call=0.039 탁월) | 1. `page.goto('/dashboard')` | `[data-testid="dash-metric-cost-call"]` grade BG `bg-emerald-500/15` (<0.04 탁월) | |
| DB-1-21 | 데이터 | P2 변형 (output/input=30 탁월) | 1. `page.goto('/dashboard')` | `[data-testid="dash-metric-out-in"]` grade BG `bg-emerald-500/15` (≥30 탁월) | |
| DB-1-22 | 데이터 | P2 변형 (composite=0.88 탁월) | 1. `page.goto('/dashboard')` | `[data-testid="dash-grade-overall"]` 텍스트 `탁월` 포함 + 배지 BG `bg-emerald-500/15` (composite ≥0.88, C-1 §4-1·§4-2) | |
| DB-1-23 | 정상 | P2 — C-1 §2 | 1. `page.goto('/dashboard')` 2. `[data-testid="dash-tip-cache-desc"]` 클릭 | modal 또는 popover 컴포넌트 1 visible + 텍스트 `cache` 또는 `캐시` 포함 ([dashboard-view.tsx:1268~1325](../../web/src/components/dashboard-view.tsx#L1268)) | C-1 §3 #3 19째 행 "자동" |
| DB-1-24 | 정상 | P2 — C-1 §2 | 1. `[data-testid="dash-tip-cache-act"]` 클릭 | modal 1 visible + 텍스트 `늘리는` 또는 `높이는` 포함 | "늘리는법" 분기 |

### 4-5. 활동 / 체류 heatmap — C-1 §4-3

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-25 | 정상 | P2 (heatmapDaily 105일 = 15주) — C-1 §2 | 1. `page.goto('/dashboard')` | `[data-testid="dash-heatmap-activity"]` 1 visible + 자식 cell 정확히 105개 (15주 × 7) 또는 ≥ 105 (`heatmapDaily.length≥105`, C-1 §4-6 min weeks 15, [dashboard-view.tsx:920](../../web/src/components/dashboard-view.tsx#L920)) | |
| DB-1-26 | 데이터 | P2 daily (date='2026-05-07', cost=4.99) — C-1 §2 변형 | 1. `page.goto('/dashboard')` | `[data-testid="dash-heatmap-activity"]` 의 2026-05-07 cell `fill` 정확히 `#4338ca` (C-1 §4-3 level 1 `<5`) | A-2 v6 §4-b heatmap 임계 |
| DB-1-27 | 데이터 | P2 daily (cost=24.99) | 1. `page.goto('/dashboard')` | 해당 cell `fill` `#6366f1` (level 2 `5~24.99`) | |
| DB-1-28 | 데이터 | P2 daily (cost=99.99) | 1. `page.goto('/dashboard')` | 해당 cell `fill` `#818cf8` (level 3 `25~99.99`) | |
| DB-1-29 | 데이터 | P2 daily (cost=100) | 1. `page.goto('/dashboard')` | 해당 cell `fill` `#a5b4fc` (level 4 `≥100`) | |
| DB-1-30 | 정상 | P2 (visitDaily dwellSec ≥ 1) — C-1 §2 | 1. `page.goto('/dashboard')` | `[data-testid="dash-heatmap-dwell"]` 1 visible (C-1 §3 #3 17째 행 "자동", [dashboard-view.tsx:1243](../../web/src/components/dashboard-view.tsx#L1243)) | |
| DB-1-31 | 데이터 | P2 visitDaily (date='2026-05-07', dwellSec=119) — C-1 §2 | 1. `page.goto('/dashboard')` | `[data-testid="dash-heatmap-dwell"]` 의 2026-05-07 cell `fill` 정확히 `#854d0e` (C-1 §4-3 level 1 `<120`) | |
| DB-1-32 | 데이터 | P2 visitDaily (dwellSec=299) | 1. `page.goto('/dashboard')` | 해당 cell `fill` `#a16207` (level 2 `120~299`) | |
| DB-1-33 | 데이터 | P2 visitDaily (dwellSec=899) | 1. `page.goto('/dashboard')` | 해당 cell `fill` `#ca8a04` (level 3 `300~899`) | |
| DB-1-34 | 데이터 | P2 visitDaily (dwellSec=900) | 1. `page.goto('/dashboard')` | 해당 cell `fill` `#facc15` (level 4 `≥900`) | |

### 4-6. visit POST + dwell beacon — C-1 §3 #3 15째·16째 행

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-35 | 정상 | P2 — C-1 §2 | 1. `page.waitForRequest('**/api/visit')` 등록 후 `page.goto('/dashboard')` | 1 POST 요청 발생 + body 비어있음 + 응답 status=200 (`{ok:true}`) (C-1 §1 `/api/visit`, [visit/route.ts:14](../../web/src/app/api/visit/route.ts#L14)) | mount-time 1회 |
| DB-1-36 | 정상 | P2 — C-1 §2 | 1. `page.goto('/dashboard')` 2. 5초 대기 3. `page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))})` 4. `page.waitForRequest('**/api/visit-end')` | 1 POST 요청 발생 + body `{"sec":n}` (n ≥ 1, n ≤ 14400 cap) + 응답 status=200 (C-1 §1·§4-6 14400 cap, [dashboard-view.tsx:417~437](../../web/src/components/dashboard-view.tsx#L417)) | C-1 §3 #3 16째 "부분" |
| DB-1-37 | 엣지 | P2 + visit-end body sec=-5 | 1. supertest 또는 fetch 로 `POST /api/visit-end` body `{sec:-5}` | 응답 status=200 + DB `daily_visits.total_dwell_seconds` 변화 0 (음수 무시, [visit-end/route.ts:16~36](../../web/src/app/api/visit-end/route.ts#L16)) | |
| DB-1-38 | 엣지 | P2 + visit-end body sec=20000 | 1. POST body `{sec:20000}` | 응답 status=200 + DB `daily_visits.total_dwell_seconds` 가 정확히 14400 누적 (cap, C-1 §4-6, [visit-end/route.ts:29](../../web/src/app/api/visit-end/route.ts#L29)) | |

### 4-7. TZ picker — C-1 §3 #3 18째

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-39 | 정상 | P2 (timezone='Asia/Singapore') — C-1 §2 | 1. `page.goto('/dashboard')` 2. `[data-testid="dash-tz-btn"]` 클릭 | `[data-testid="dash-tz-list"]` 1 visible (toggle 열림, [dashboard-view.tsx:667](../../web/src/components/dashboard-view.tsx#L667)) | |
| DB-1-40 | 정상 | DB-1-39 진행 | 1. `[data-testid="dash-tz-list"]` 자식에서 `Asia/Seoul` option 클릭 2. `page.waitForRequest('**/api/user/timezone')` | 1 PATCH 요청 + body `{"timezone":"Asia/Seoul"}` + 응답 `{"ok":true}` | C-1 §3 #3 18째 "자동" |

### 4-8. /member admin selector — C-1 §3 #7

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-41 | 정상 | P3 admin + P2 멤버 (id=10), P4 멤버 (id=13), P5 멤버 (id=14) — C-1 §2 | 1. `page.goto('/member')` | `[data-testid="dash-member-select"]` 1 visible + 자식 `<option>` count ≥ 3 (멤버 목록, [dashboard-view.tsx:629~634](../../web/src/components/dashboard-view.tsx#L629)) | |
| DB-1-42 | 정상 | DB-1-41 + 처음 진입 (localStorage 비어있음) | 1. `page.goto('/member')` 2. `[data-testid="dash-member-select"]` 으로 P2 (id=10) 선택 | `[data-testid="dash-overview-bar"]` 텍스트 갱신 + localStorage `teamMemberSelectedUserId` 정확히 `10` (`localStorage.getItem`, C-1 §3 #7) | |

### 4-9. 엣지케이스

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| DB-1-43 | 엣지 | P3 admin + P8 (admin email + no snapshot) — C-1 §2 P8 | 1. `page.goto('/dashboard')` | URL 이 `/setup` 으로 변경 (admin 이라도 본인 데이터 없으면 setup, [dashboard-view.tsx:522](../../web/src/components/dashboard-view.tsx#L522)) | C-1 §2 P8 분기 |
| DB-1-44 | 엣지 | P2 + dailyCost length=46 — C-1 §2 변형 | 1. `page.goto('/dashboard')` | `[data-testid="dash-card-daily-cost"]` 자식에 scroll 영역 존재 (length>45 임계, C-1 §4-6, [dashboard-view.tsx:702,736](../../web/src/components/dashboard-view.tsx#L702)) | |
| DB-1-45 | 엣지 | P2 + topSessions 6개 — C-1 §2 변형 | 1. `page.goto('/dashboard')` | `[data-testid="dash-card-top-sessions"]` 자식 row count 정확히 5 (C-1 §4-6 #3 TopSessions display 5, [dashboard-view.tsx:987](../../web/src/components/dashboard-view.tsx#L987)) | 6번째 미렌더 |
| DB-1-46 | 엣지 | P2 + heatmapDaily length=182 (= 26주) — C-1 §2 변형 | 1. `page.goto('/dashboard')` | `[data-testid="dash-heatmap-activity"]` cell count 정확히 182 (`heatmapDaily.length≥26*7`, C-1 §4-6 max weeks 26) | boundary 26주 |
| DB-1-47 | 엣지 | P2 + page.route stub `/api/dashboard?period=today` 응답 `dailyTokens=[]` | 1. `page.goto('/dashboard')` 2. period today 클릭 | `[data-testid="dash-card-daily-tokens"]` 텍스트 `no data` 포함 (C-1 §4-5, [dashboard-view.tsx:710](../../web/src/components/dashboard-view.tsx#L710)) | |
| DB-1-48 | 엣지 | P2 + `page.route('**/api/dashboard*', delay=10000)` (overview-missing 4s 폴링) | 1. `page.goto('/dashboard')` 2. 9초 대기 (`waitForTimeout(9000)`) | `/api/dashboard*` 호출 횟수 ≥ 2 (mount + 4000ms 폴링, C-1 §4-6 polling 4000ms, [dashboard-view.tsx:484~488](../../web/src/components/dashboard-view.tsx#L484)) | |

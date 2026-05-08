# [TM] 팀 랭킹 — QA 테스트케이스

## 1. 문서 개요

| 항목 | 내용 |
| --- | --- |
| 대상 기능 | 팀 페이지 7 row (Period tab + Summary + By Member + Total + Activity/Cost + Efficiency + Engagement[admin] + Top Sessions[admin] + Industry Comparison) |
| 기획 문서 (A-2) | [docs/03_A-2_…v6.md §2 #4 + §4 #4](../03_A-2_프로세스를_화면으로_사용량대시보드_v6.md) |
| C-1 brief | [§1 `/api/team` · §3 #4 행 7개 · §4-1 효율 5단계 · §4-2 등급 색 · §4-5 ADMIN/미수신/ccusage❌/Row7 punchline · §4-6 SyncBadge 임계 · §5-2 #4 team-* testid](../C-1.qa-implementation-brief.md) |
| 대상 앱 | 공통 (어드민 분기 row 6·7) |
| 작성일 | 2026-05-08 |

## 2. 공통 사전조건

| 조건 | 상세 (C-1 페르소나 ID) |
| --- | --- |
| 테스트 환경 | 로컬 dev (`http://localhost:3000`) |
| 기본 계정 | P2 (정상-일반) — C-1 §2 |
| 필요 데이터 | `psql < db/seed/P2.sql` + 다른 멤버 P3/P4/P5/P6 각 1명 시드 (`db/seed/team-mixed.sql` — P2 alice id=10, P3 eugene id=12, P4 stale-2 bob id=13, P5 stale-8 carol id=14, P6 ccusage-missing dave id=15) |
| ENV | `ADMIN_EMAIL=eugene.eee@iskra.world` (P3 만 admin), industry 30일 ccusageDaily 시드 |

## 3. 접근 권한 테스트

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-0-01 | 권한 | (비로그인) | 1. session 쿠키 없이 `page.goto('/team')` | URL 이 `/login?callbackUrl=%2Fteam` 패턴으로 변경 — `/api/team` 401 ([route.ts:109](../../web/src/app/api/team/route.ts#L109)) | |
| TM-0-02 | 권한 | P2 (id=10, non-admin) — C-1 §2 | 1. session 쿠키 + `page.goto('/team')` | `[data-testid="team-card-engagement"]` count=0 + `[data-testid="team-card-top-sessions"]` count=0 (admin only row, [team/page.tsx:709](../../web/src/app/team/page.tsx#L709) `isAdminUser=false` 분기) | C-1 §3 #4 여섯째 행 "자동" |
| TM-0-03 | 권한 | P3 (admin email) — C-1 §2 | 1. P3 시드 후 `page.goto('/team')` | `[data-testid="team-card-engagement"]` 1 visible + `[data-testid="team-card-top-sessions"]` 1 visible (`isAdminUser=true`, [team/route.ts:isAdminUser](../../web/src/app/api/team/route.ts) 응답) | |

## 4. 화면별 테스트

### 4-1. Row 1 Period tab — A-2 §2 #4 / C-1 페르소나 P2

#### 정상 동작

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-01 | 정상 | P2 (id=10) — C-1 §2 | 1. `page.goto('/team')` | 5 testid 모두 visible — `[data-testid="team-period-today"]` `team-period-month` `team-period-8days` `team-period-30days` `team-period-all` (C-1 §4-5, [team/page.tsx:14~16,313](../../web/src/app/team/page.tsx#L14)) | default `all` ([route.ts:107](../../web/src/app/api/team/route.ts#L107)) |
| TM-1-02 | 정상 | P2 — C-1 §2 | 1. `page.goto('/team')` 2. `[data-testid="team-period-8days"]` 클릭 3. `page.waitForResponse(r=>r.url().includes('/api/team?period=8days'))` | 1 GET 요청 발생 + 응답 status=200 | |

### 4-2. Row 2 Summary bar / By Member / Total — C-1 페르소나 P2 + 다른 멤버 1명

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-03 | 정상 | P2 + 1 다른 멤버 시드 — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-summary-bar"]` 1 visible + `[data-testid="team-card-by-member"]` 1 visible + `[data-testid="team-card-total"]` 1 visible ([team/page.tsx:325,348,390](../../web/src/app/team/page.tsx#L325)) | |
| TM-1-04 | 정상 | DB rows=0 (모든 user 미시드) — C-1 §2 P1 변형 | 1. `psql -c "TRUNCATE users CASCADE;"` 후 P3 admin 만 시드 (다른 멤버 0) 2. `page.goto('/team')` | `[data-testid="team-empty"]` 1 visible + 텍스트 `해당 기간에 활동 데이터가 없어요.` (C-1 §4-5, [team/page.tsx:338](../../web/src/app/team/page.tsx#L338)) | |

### 4-3. Row 3 Activity / Cost — C-1 페르소나 P2

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-05 | 정상 | P2 — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-card-activity"]` 1 visible + `[data-testid="team-card-cost"]` 1 visible ([team/page.tsx:429,466](../../web/src/app/team/page.tsx#L429)) | |

### 4-4. Row 4 Efficiency 표 — C-1 §4-1 5등급

#### 정상 동작 + 경계값

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-06 | 정상 | P2 (id=10, cache=91.4) — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-eff-row-10"]` 1 visible + `[data-testid="team-eff-cache-10"]` cell BG 클래스 `bg-green-500/20` (cache 91 → 양호, C-1 §4-2, [team/page.tsx:34~40](../../web/src/app/team/page.tsx#L34)) | |
| TM-1-07 | 데이터 | P2 변형 (cache=96, oneshot=90, costPerSession=9.99, cost/call=0.039, output/input=30, composite=0.88) — C-1 §4-1 탁월 boundary | 1. `psql < db/seed/P2-grade-emerald.sql` 2. `page.goto('/team')` | `[data-testid="team-eff-overall-10"]` cell BG `bg-emerald-500/25` (composite ≥ 0.88, C-1 §4-1·§4-2) | 탁월 등급 |
| TM-1-08 | 데이터 | P2 변형 (cache=89, oneshot=70, costPerSession=49.99, composite=0.6) — 보통 boundary | 1. `page.goto('/team')` | `[data-testid="team-eff-overall-10"]` cell BG `bg-slate-600/25` (composite 0.52~0.719, C-1 §4-2) | 보통 등급 |
| TM-1-09 | 데이터 | P2 변형 (cache=59, oneshot=59, costPerSession=100) — 경고 boundary | 1. `page.goto('/team')` | `[data-testid="team-eff-overall-10"]` cell BG `bg-red-500/30` (composite <0.32, C-1 §4-2) | 경고 등급 |
| TM-1-10 | 데이터 | P2 변형 (cache=80, 보통) | 1. `page.goto('/team')` | `[data-testid="team-eff-cache-10"]` cell BG `bg-slate-600/25` (cache 80~89 → 보통, C-1 §4-1) | 보통 cache |

### 4-5. Row 5 SyncBadge / ccusage badge — C-1 §4-6

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-11 | 데이터 | P3 admin + P4 (id=13, lastSyncedAt=NOW()-60h ≈ 2.5d) — C-1 §2 | 1. P3 로그인 + `page.goto('/team')` | `[data-testid="team-sync-badge-13"]` 텍스트가 `2일전` 포함 + CSS class `text-yellow-500` (`days≥2 && days<5`, C-1 §4-6, [team/page.tsx:184](../../web/src/app/team/page.tsx#L184)) | C-1 §4-6 SyncBadge yellow |
| TM-1-12 | 데이터 | P3 admin + P5 (id=14, lastSyncedAt=NOW()-8d) — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-sync-badge-14"]` 텍스트가 `⚠` + `8일` 포함 + CSS class `text-red-*` (`days≥5`, C-1 §4-6, [team/page.tsx:183](../../web/src/app/team/page.tsx#L183)) | red ⚠ |
| TM-1-13 | 데이터 | P3 admin + 비sync 멤버 (id=16, lastSyncedAt=null) | 1. `page.goto('/team')` | `[data-testid="team-sync-badge-16"]` 텍스트가 정확히 `미수신` 포함 + CSS class `text-red-*` (C-1 §4-5, [team/page.tsx:124,181](../../web/src/app/team/page.tsx#L124)) | |
| TM-1-14 | 데이터 | P3 admin + P6 (id=15, ccusageMissing=true) — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-ccusage-badge-15"]` 텍스트가 정확히 `ccusage❌` 포함 + tooltip 속성 `title` 정확히 `ccusage 미설치 — 토큰/비용 데이터가 수집되지 않습니다. npm install -g ccusage 후 repair 실행 필요` (C-1 §4-5, [team/page.tsx:135~140](../../web/src/app/team/page.tsx#L135)) | |
| TM-1-15 | 데이터 | P3 admin (본인) — C-1 §2 P3 | 1. `page.goto('/team')` | `[data-testid="team-eff-row-12"]` 행에 `ADMIN` 텍스트 1 visible (amber 배지, C-1 §4-5, [team/page.tsx:117~121](../../web/src/app/team/page.tsx#L117)) | |

### 4-6. Row 6 Engagement / Top Sessions (admin only)

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-16 | 정상 | P3 admin + daily_visits 시드 (P2 id=10, today count=5, dwell=1240s) — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-card-engagement"]` 1 visible + `[data-testid="team-eng-row-10"]` 1 visible + `[data-testid="team-eng-visits-10"]` 텍스트가 `5` 포함 ([team/page.tsx:711,748~753](../../web/src/app/team/page.tsx#L711)) | C-1 §3 #4 셋째 행 "자동" |
| TM-1-17 | 데이터 | P3 admin + 멤버 (id=10, today visits=0) — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-eng-visits-10"]` cell CSS class `text-red-*` (`visitsClass red(0)`, C-1 §4-* engagement, [team/page.tsx:742~746](../../web/src/app/team/page.tsx#L742)) | red(0) |
| TM-1-18 | 데이터 | P3 admin + 멤버 (id=10, today visits=2) | 1. `page.goto('/team')` | `[data-testid="team-eng-visits-10"]` cell CSS class `text-yellow-*` (`yellow(<4)`) | yellow |
| TM-1-19 | 데이터 | P3 admin + 멤버 (id=10, today visits=4) | 1. `page.goto('/team')` | `[data-testid="team-eng-visits-10"]` cell CSS class 가 `text-yellow-*`/`text-red-*` 둘 다 미포함 (`normal(≥4)`) | normal |
| TM-1-20 | 정상 | P3 admin + topSessions 배열 ≥ 1 — C-1 §2 P3 fixture | 1. `page.goto('/team')` | `[data-testid="team-card-top-sessions"]` 1 visible + 자식 row count ≤ 15 (C-1 §4-6 TopSessions display 15, [team/route.ts:380](../../web/src/app/api/team/route.ts#L380)) | C-1 §3 #4 넷째 행 "자동" |

### 4-7. Row 7 Industry Comparison — C-1 §4-5 punchline

#### 정상 동작

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-21 | 정상 | P2 + 30일 ccusage daily 시드 (activeDayCount > 0) — C-1 §2 P2 변형 | 1. `page.goto('/team')` | `[data-testid="team-card-industry"]` 1 visible + 텍스트 `Primus vs 업계 (Claude Code, 최근 30일)` 포함 (C-1 §4-5 Row7 title, [team/page.tsx:841](../../web/src/app/team/page.tsx#L841)) | C-1 §3 #4 다섯째 행 "자동" — 모든 멤버 노출 |
| TM-1-22 | 정상 | TM-1-21 동일 | 1. `page.goto('/team')` | `[data-testid="team-industry-external"]` 텍스트가 `Anthropic 평균 사용자 $6 / day` + `엔터 active day 평균 $13 / day` + `as of 2026-05` 모두 포함 (C-1 §4-5, [team/page.tsx:850~882](../../web/src/app/team/page.tsx#L850)) | |
| TM-1-23 | 정상 | P2 (TM-1-21 동일 fixture) — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-industry-ours"]` 자식에 `active day 평균` `p50` `p75` `p90` `max` 텍스트 5개 모두 포함 (C-1 §1 `industryComparison.{activeDayAvg,activeDayP50,activeDayP75,activeDayP90,activeDayMax}` 응답 5필드, A-2 §4 #4 4-a wireframe) | |
| TM-1-24 | 정상 | TM-1-21 + activeDayAvg=26 (= $13 × 2) — fixture 변형 | 1. `page.goto('/team')` | `[data-testid="team-industry-punch"]` 텍스트가 `Primus 는 엔터 active day 평균 ($13) 대비 2.0배 — Claude Code 적극 활용 팀` 와 정확히 일치 (multiplier `26/13=2.0`, C-1 §4-5·§4-6 분모 $13, [team/page.tsx:836,920~922](../../web/src/app/team/page.tsx#L836)) | |

#### 데이터 검증

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-25 | 데이터 | TM-1-21 + `page.route('**/api/team*', r=>{const j=JSON.parse(...);delete j.industryComparison;r.fulfill({body:JSON.stringify(j)})})` | 1. route stub 활성 후 `page.goto('/team')` | `[data-testid="team-card-industry"]` count=0 (`industryComparison===undefined` 미렌더, C-1 §3 #4 일곱째 행 "자동", [team/page.tsx:832](../../web/src/app/team/page.tsx#L832)) | A-2 §4 #4 4-d 상태 |
| TM-1-26 | 데이터 | P2 + ccusage daily 0건 (activeDayCount=0) — C-1 §2 변형 | 1. `page.goto('/team')` | `[data-testid="team-card-industry"]` count=0 (`activeDayCount===0` 미렌더, [team/page.tsx:832](../../web/src/app/team/page.tsx#L832)) | A-2 §4 #4 4-d 둘째 분기 |
| TM-1-27 | 데이터 | P2 (TM-1-21 fixture 변형) + activeDayAvg=39 ($13 × 3) — C-1 §2·§4-6 분모 $13 | 1. `page.goto('/team')` | `[data-testid="team-industry-punch"]` 텍스트가 `3.0배` 포함 (C-1 §4-5 multiplier `activeDayAvg/13`, [team/page.tsx:836](../../web/src/app/team/page.tsx#L836)) | multiplier 3.0 검증 |

### 4-8. By Member chart palette — C-1 §4-4

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-28 | 데이터 | P2 + 8 멤버 시드 (id=10..17 모두 데이터 있음) — C-1 §2 변형 | 1. `page.goto('/team')` 2. `[data-testid="team-card-by-member"]` 자식 SVG `path` 또는 `<g>` color 속성 8개 인용 | 8 색이 정확히 `#4f46e5, #10b981, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #f97316, #ec4899` 순서로 cycle (C-1 §4-4, [team/page.tsx:42~45](../../web/src/app/team/page.tsx#L42)) | |

### 4-9. 엣지케이스

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TM-1-29 | 엣지 | P2 + `page.route('**/api/team*', r=>r.fulfill({status:500,body:'{}'}))` | 1. `page.goto('/team')` | (#4 fetch 실패 UX 미정 — A-2 §4 #4 4-d "라이브 fetch 실패 시 카드 자체 미렌더") | A-2 §4 #4 4-d 셋째 분기 — `[data-testid="team-card-industry"]` count=0 + 다른 row 동작은 docs 미정 [B] |
| TM-1-30 | 엣지 | P3 admin + 멤버 8명 중 P5 (8일 stale) 1명 — C-1 §2 | 1. `page.goto('/team')` | `[data-testid="team-card-engagement"]` 의 첫 번째 행 = `team-eng-row-{P5.userId}` (오래된 lastSyncedAt 우선 정렬, [team/page.tsx:728~734](../../web/src/app/team/page.tsx#L728)) | C-1 §2 P5 "Engagement 행 정렬 최상단" |
| TM-1-31 | 엣지 | P2 + stale 멤버 P5 fixture (rawJson today daily[0].date = 어제) — C-1 §2 stale 필터 | 1. `page.goto('/team')` | `[data-testid="team-eff-row-14"]` 의 cost cell 텍스트가 `$0` 또는 `0` (stale 멤버 → 0 처리, A-2 §0-b "stale 멤버 필터") | |

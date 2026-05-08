# [TP] 멤버 공개 프로필 — QA 테스트케이스

## 1. 문서 개요

| 항목 | 내용 |
| --- | --- |
| 대상 기능 | 멤버 공개 프로필 (summary 4 cell + 4주 heatmap + 프로젝트 10개) |
| 기획 문서 (A-2) | [docs/03_A-2_프로세스를_화면으로_사용량대시보드_v6.md §2 #5 + §4 #5](../03_A-2_프로세스를_화면으로_사용량대시보드_v6.md) |
| C-1 brief | [§1 `/api/members/[userId]` · §3 #5 행 2개 · §4-3 활동 heatmap 임계 · §4-6 #5 4주 고정 · §5-2 #5 member-* testid](../C-1.qa-implementation-brief.md) |
| 대상 앱 | 공통 (모든 로그인 사용자가 멤버 프로필 조회 가능) |
| 작성일 | 2026-05-08 |

## 2. 공통 사전조건

| 조건 | 상세 (C-1 페르소나 ID) |
| --- | --- |
| 테스트 환경 | 로컬 dev (`http://localhost:3000`) |
| 기본 계정 | P2 (정상-일반, full data) — C-1 §2 |
| 필요 데이터 | `psql < db/seed/P2.sql` — `users.id=10`, alice@iskra.world, 30일 ccusage daily 시드 ([C-1 §2 P2](../C-1.qa-implementation-brief.md)) |

## 3. 접근 권한 테스트

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TP-0-01 | 권한 | (비로그인) | 1. session 쿠키 없이 `page.goto('/team/10')` | URL 이 `/login?callbackUrl=%2Fteam%2F10` 패턴으로 변경 — `/api/members/10` 401 ([route.ts:46](../../web/src/app/api/members/[userId]/route.ts#L46)) | |
| TP-0-02 | 권한 | P2 (id=10) — C-1 §2 | 1. session 쿠키 + `page.goto('/team/99999')` (존재하지 않는 userId) | (C-1 §1 `/api/members/[userId]` 404 응답 시 페이지 처리 — A-2 §4 #5 미정) | [B] BLOCKED — A-2 §4 #5 에 404 UX 명시 안 됨. spec 동작 확인 후 docs 보강 필요 |

## 4. 화면별 테스트

### 4-1. `/team/[userId]` 멤버 프로필 — A-2 §2 #5 / C-1 페르소나 P2·P3

#### 정상 동작

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TP-1-01 | 정상 | P2 (id=10, totalCost=423.78) — C-1 §2 | 1. `page.goto('/team/10')` | `[data-testid="member-summary-cost"]` 텍스트가 정확히 `$423.78` 또는 `$423.78` 포함 — C-1 §2 P2 fixture totalCost ([api/members:88~98](../../web/src/app/api/members/[userId]/route.ts#L88), [team/[userId]/page.tsx:75~91](../../web/src/app/team/[userId]/page.tsx#L75)) | |
| TP-1-02 | 정상 | P2 (sessionsCount=92) — C-1 §2 | 1. `page.goto('/team/10')` | `[data-testid="member-summary-sessions"]` 텍스트가 `92` 포함 — C-1 §2 P2 sessions_count | |
| TP-1-03 | 정상 | P2 (cacheHitPct=91.4) — C-1 §2 | 1. `page.goto('/team/10')` | `[data-testid="member-summary-cache"]` 텍스트가 `91` 포함 + `%` 단위 (정수 또는 소수 1자리, [api/members:88~98](../../web/src/app/api/members/[userId]/route.ts#L88)) | C-1 §2 P2 cache_hit_pct |
| TP-1-04 | 정상 | P2 (daily 30일 연속) — C-1 §2 P2 fixture daily 채움 | 1. `page.goto('/team/10')` | `[data-testid="member-summary-streak"]` 텍스트가 ≥ `1` 의 양수 (C-1 §1 `streak`, [api/members:88~98](../../web/src/app/api/members/[userId]/route.ts#L88)) | streak 정확값은 fixture daily 시드 형태에 의존 — 양수 검증으로 한정 |
| TP-1-05 | 정상 | P2 — C-1 §2 | 1. `page.goto('/team/10')` | `[data-testid="member-heatmap-4w"]` 1 visible + 자식 `rect` 또는 `td` 요소 정확히 28개 (4주 × 7일, [team/[userId]/page.tsx:46](../../web/src/app/team/[userId]/page.tsx#L46) i=27→0) | C-1 §4-6 #5 4주 고정 |
| TP-1-06 | 정상 | P2 (projects ≥ 1) — C-1 §2 P2 fixture | 1. `page.goto('/team/10')` | `[data-testid^="member-project-row-"]` count ≥ 1 + count ≤ 10 (C-1 §1 `projects[]` 배열 슬라이스 10, [api/members:117](../../web/src/app/api/members/[userId]/route.ts#L117)) | |

#### 데이터 검증

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TP-1-07 | 데이터 | P2 daily 시드 (date='2026-05-07', cost=4) — C-1 §2 P2 변형 | 1. `page.goto('/team/10')` | `[data-testid="member-heatmap-4w"]` 의 2026-05-07 cell `fill` 속성 정확히 `#4338ca` (C-1 §4-3 level 1 `<$5`, [team/[userId]/page.tsx:54~59](../../web/src/app/team/[userId]/page.tsx#L54)) | level 1 boundary |
| TP-1-08 | 데이터 | P2 daily 시드 (cost=24) — C-1 §2 변형 | 1. `page.goto('/team/10')` | 해당 cell `fill` 정확히 `#6366f1` (C-1 §4-3 level 2 `5~24.99`) | level 2 |
| TP-1-09 | 데이터 | P2 daily 시드 (cost=99) | 1. `page.goto('/team/10')` | 해당 cell `fill` 정확히 `#818cf8` (C-1 §4-3 level 3 `25~99.99`) | level 3 |
| TP-1-10 | 데이터 | P2 daily 시드 (cost=100) | 1. `page.goto('/team/10')` | 해당 cell `fill` 정확히 `#a5b4fc` (C-1 §4-3 level 4 `≥100`) | level 4 boundary |
| TP-1-11 | 데이터 | P2 daily 시드 (cost=0) | 1. `page.goto('/team/10')` | 해당 cell `fill` 정확히 `#1e293b` (C-1 §4-3 level 0 `=0`) | level 0 |
| TP-1-12 | 데이터 | P2 daily 시드 11개 프로젝트 (project_a~k, 각 cost ≥ 0.01) — C-1 §2 변형 | 1. `page.goto('/team/10')` | `[data-testid^="member-project-row-"]` count 정확히 `10` (C-1 §1 `/api/members/[userId]` projects.slice(0,10), [api/members:117](../../web/src/app/api/members/[userId]/route.ts#L117)) | 11번째 미렌더 |

#### 엣지케이스

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| TP-1-13 | 엣지 | P1 (DB rows=0) — C-1 §2 | 1. P1 시드 후 `page.goto('/team/10')` | `/api/members/10` 응답 status=404 + 페이지 동작 (C-1 §1 404 분기, [route.ts:50](../../web/src/app/api/members/[userId]/route.ts#L50)) | TP-0-02 와 동일 docs 부족 — [B] |
| TP-1-14 | 엣지 | P3 (admin email, id=10) — C-1 §2 | 1. P3 시드 후 자기 자신 `page.goto('/team/10')` | TP-1-01 ~ TP-1-06 와 동일 결과 (#5 는 admin 분기 없음 — A-2 §2 #5 권한 컬럼 `—`) | A-2 §2 #5 admin 컬럼 `—` 검증 |
| TP-1-15 | 엣지 | P2 daily=0 30일 연속 (heatmap 모두 0) — C-1 §2 변형 | 1. `page.goto('/team/10')` | `[data-testid="member-heatmap-4w"]` 의 모든 28 cell `fill` 정확히 `#1e293b` + `[data-testid="member-summary-streak"]` 텍스트 `0` | C-1 §1 streak=0 케이스 |

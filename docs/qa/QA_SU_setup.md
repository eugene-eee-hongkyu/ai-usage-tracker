# [SU] 셋업 — QA 테스트케이스

## 1. 문서 개요

| 항목 | 내용 |
| --- | --- |
| 대상 기능 | OS 자동 분기 + install 명령 + tz 감지/변경 + 셋업 진행 폴링 (2s) + step 라벨 |
| 기획 문서 (A-2) | [docs/03_A-2_프로세스를_화면으로_사용량대시보드_v6.md §2 #2](../03_A-2_프로세스를_화면으로_사용량대시보드_v6.md) |
| C-1 brief | [§1 `/api/setup/status` `/api/user/timezone` · §3 #2 행 7개 · §4-5 셋업 라벨 · §4-6 polling 2000ms · §5-2 #2 setup-* testid](../C-1.qa-implementation-brief.md) |
| 대상 앱 | 공통 |
| 작성일 | 2026-05-08 |

## 2. 공통 사전조건

| 조건 | 상세 (C-1 페르소나 ID) |
| --- | --- |
| 테스트 환경 | 로컬 dev (`http://localhost:3000`) |
| 기본 계정 | P1 (신규, DB rows=0, lastSyncedAt=null) — C-1 §2 |
| 필요 데이터 | `psql -c "TRUNCATE users, user_snapshots, period_snapshots, daily_visits CASCADE;"` + Credentials mock 으로 `signIn('credentials',{email:'alice@iskra.world'})` (C-1 §3 #1 우회) |
| ENV | `NEXT_PUBLIC_GITHUB_ORG=eugene-eee-hongkyu` (C-1 §4-7) |

## 3. 접근 권한 테스트

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| SU-0-01 | 권한 | (비로그인) — C-1 §2 P1 변형 | 1. session 쿠키 없이 `page.goto('/setup')` | URL 이 `/login?callbackUrl=%2Fsetup` 패턴으로 변경 — middleware redirect | LO-0-* 와 동일 패턴 |

## 4. 화면별 테스트

### 4-1. `/setup` 가이드 화면 — A-2 §2 #2 / C-1 페르소나 P1

#### 정상 동작

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| SU-1-01 | 정상 | P1 (로그인 직후) — C-1 §2 + `browser.newContext({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})` | 1. `page.goto('/setup')` | `[data-testid="setup-os-badge"]` 텍스트 정확히 `macOS` ([setup/page.tsx:36~40](../../web/src/app/setup/page.tsx#L36) `/Mac/` regex) + `[data-testid="setup-install-cmd"]` 텍스트가 `curl -fsSL` 으로 시작하고 `/install.sh \| bash` 으로 끝남 (C-1 §4-5, [setup/page.tsx:89](../../web/src/app/setup/page.tsx#L89)) | C-1 §3 #2 첫 행 "자동" |
| SU-1-02 | 정상 | P1 + `userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'` | 1. `page.goto('/setup')` | `[data-testid="setup-os-badge"]` 텍스트 정확히 `Windows` + `[data-testid="setup-install-cmd"]` 텍스트가 `irm` 으로 시작하고 `/install.ps1 \| iex` 으로 끝남 (C-1 §4-5, [setup/page.tsx:87](../../web/src/app/setup/page.tsx#L87)) | |
| SU-1-03 | 정상 | P1 + `userAgent:'Mozilla/5.0 (X11; Linux x86_64)'` | 1. `page.goto('/setup')` | `[data-testid="setup-os-badge"]` 텍스트 정확히 `기타` + `[data-testid="setup-npx-cmd"]` 1 visible (수동 npx fallback, [setup/page.tsx:84](../../web/src/app/setup/page.tsx#L84)) | C-1 §4-5 manual npx fallback |
| SU-1-04 | 정상 | P1 (mac UA) — C-1 §2 | 1. `page.goto('/setup')` 2. `[data-testid="setup-npx-cmd"]` 텍스트 인용 | `[data-testid="setup-npx-cmd"]` 텍스트가 정확히 `npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker init` (`NEXT_PUBLIC_GITHUB_ORG` env 치환, C-1 §4-5·§4-7) | |
| SU-1-05 | 정상 | P1 + `context.grantPermissions(['clipboard-read','clipboard-write'])` — C-1 §3 #2 둘째 행 | 1. `page.goto('/setup')` 2. `[data-testid="setup-install-copy"]` 클릭 3. `page.evaluate(()=>navigator.clipboard.readText())` | clipboard 텍스트가 `[data-testid="setup-install-cmd"]` 의 `textContent` 와 정확히 일치 ([setup/page.tsx:93](../../web/src/app/setup/page.tsx#L93) `navigator.clipboard.writeText`) | C-1 §3 #2 "부분" — 권한 grant 필요 |
| SU-1-06 | 정상 | P1 + `browser.newContext({timezoneId:'Asia/Seoul'})` — C-1 §3 #2 셋째 행 | 1. `page.goto('/setup')` | `[data-testid="setup-tz-select"]` value 정확히 `Asia/Seoul` ([setup/page.tsx:47](../../web/src/app/setup/page.tsx#L47) `Intl.DateTimeFormat().resolvedOptions().timeZone`) | |
| SU-1-07 | 정상 | P1 + `timezoneId:'Asia/Seoul'` | 1. `page.goto('/setup')` 2. `[data-testid="setup-tz-select"]` 으로 `America/Los_Angeles` 선택 3. `page.waitForRequest('**/api/user/timezone')` | 1 PATCH 요청 발생 + body `{"timezone":"America/Los_Angeles"}` + 응답 `{"ok":true}` (C-1 §1 `/api/user/timezone` PATCH, [user/timezone/route.ts:7](../../web/src/app/api/user/timezone/route.ts#L7)) | |

#### 데이터 검증

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| SU-1-08 | 데이터 | P1 + `page.route('**/api/setup/status', r=>r.fulfill({status:200,body:JSON.stringify({ready:false,lastSyncedAt:null,sessionsCount:0,steps:{cli_installed:false,hook_registered:false,first_session:false}})}))` | 1. `page.goto('/setup')` 2. 5초 대기 (폴링 2회 이상) | `[data-testid="setup-step-hook"]` 텍스트가 정확히 `hook 등록` 포함 + 진행중 마크 (CSS class 미체크 / 아이콘 ⏳ 또는 빈 동그라미) (C-1 §4-5, [setup/page.tsx:28~30](../../web/src/app/setup/page.tsx#L28)) + `[data-testid="setup-go-dashboard"]` count=0 | C-1 §4-6 폴링 2000ms |
| SU-1-09 | 데이터 | P1 + `page.route('**/api/setup/status', r=>r.fulfill({status:200,body:JSON.stringify({ready:true,lastSyncedAt:'2026-05-08T10:00:00Z',sessionsCount:1,steps:{cli_installed:true,hook_registered:true,first_session:true}})}))` | 1. `page.goto('/setup')` 2. 3초 대기 | `[data-testid="setup-go-dashboard"]` 1 visible + 텍스트 정확히 `대시보드로 가기 →` (C-1 §4-5, [setup/page.tsx:200](../../web/src/app/setup/page.tsx#L200)) | |
| SU-1-10 | 데이터 | P1 + SU-1-09 stub | 1. `page.goto('/setup')` 2. 3초 대기 3. `[data-testid="setup-go-dashboard"]` 클릭 | URL 이 `/dashboard` 로 변경 (`page.url()` 정확히 `http://localhost:3000/dashboard`) | |
| SU-1-11 | 데이터 | P1 + page.route stub 으로 `/api/setup/status` 호출 횟수 카운터 | 1. `page.goto('/setup')` 2. 정확히 5500ms 대기 (`page.waitForTimeout(5500)`) | 카운터 ≥ 2 (C-1 §4-6 polling 2000ms — 5.5초간 mount 직후 1회 + 2초마다 → 최소 2회) | C-1 §3 #2 여섯째 행 "자동" |

#### 엣지케이스

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| SU-1-12 | 엣지 | P1 + tz select 에 invalid value 강제 (`page.evaluate(()=>document.querySelector('[data-testid=setup-tz-select]').value='not_a_real_tz')` + dispatchEvent change) | 1. `page.goto('/setup')` 2. invalid value dispatch 3. `page.waitForResponse(r=>r.url().includes('/api/user/timezone'))` | 응답 status=400 + body `{"error":"invalid timezone"}` (C-1 §1 `/api/user/timezone` 400 분기, [route.ts:14,20](../../web/src/app/api/user/timezone/route.ts#L14)) | `Intl.DateTimeFormat` 거부 |
| SU-1-13 [M] | 엣지 | P1 (mac, 진짜 OS) | 1. 터미널에서 `curl -fsSL http://localhost:3000/install.sh \| bash` 실행 2. launchd 로 `~/Library/LaunchAgents/com.primus.usage-tracker.daily.plist` 등록 확인 | `launchctl list \| grep com.primus.usage-tracker` 1 row + plist 파일 존재 + 다음 sync 시 `/api/ingest` 호출 ([cli/index.mjs:1062](../../cli/src/index.mjs#L1062) `launchctl bootstrap`) | C-1 §3 #2 다섯째 행 "수동" — Playwright 권한 밖 |
| SU-1-14 | 엣지 | P1 + `page.route('**/api/setup/status', r=>r.fulfill({status:500,body:'{}'}))` | 1. `page.goto('/setup')` 2. 3초 대기 | (C-1 §1 `/api/setup/status` 500 분기 — 명시 안됨) | [B] BLOCKED — docs 부족: setup 페이지 fetch 실패 시 동작 미정 ([setup/page.tsx](../../web/src/app/setup/page.tsx) catch 분기 확인 필요). #8 setup-status 와 달리 #2 setup 은 fetch 실패 UX 미정의 — A-2 §4 #2 보강 필요 |

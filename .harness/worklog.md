# worklog.md — 작업 기록

> 최신 세션이 위에 오도록 역순으로 작성한다.

---

## Session 2026-05-01 10:37 — codeburn UTC 버그 우회 + 30일 period + 팀 stale 멤버 필터

### 작업 요약
- **submit.log 가시성 fix** (`47539f0` → `cc17d9b`): 자식 stdio가 `"ignore"`라 디버깅 불가했던 문제. `openSync(out)` 후 `[ignore, out, out]`로 바꿨지만 repair의 immediate sync는 `_USAGE_TRACKER_DETACHED=1` 미리 set되어 self-detach 우회 → stdout=/dev/null. `appendFileSync(SUBMIT_LOG, line)` 직접 쓰기로 바꿔 어떤 호출 경로든 로그 남도록.
- **dashboard 오늘 override** (`e58a475`): codeburn UTC today가 SGT 자정~UTC 자정 사이엔 어제 날짜 리턴. ccusage max date가 더 미래면 `rawDaily = [{ date: ccusage today, cost, sessions:0 }]`로 교체. Daily Activity / Cost 차트와 overview cost/tokens가 사용자 로컬 today로 보임. activities/projects/sessions/calls은 codeburn UTC 그대로 (재집계 불가).
- **codeburn 업스트림 PR #186 merged**: `--timezone` flag + `CODEBURN_TZ` env var 추가됐으나 npm 0.9.4까지 미배포. GitHub master에서 직접 설치 시 `dist/` 미빌드라 실패. 일단 우회 진행.
- **CLI TZ env 주입** (`1eb917f` + `c2b655e`): launchd가 Node에 TZ env 안 넘겨주는 게 근본 원인. `Intl.DateTimeFormat().resolvedOptions().timeZone`로 system tz 읽어서 `spawn(codeburn, ..., env: { TZ, CODEBURN_TZ })` 명시 주입. submit.log에 `SYSTEM_TZ=Asia/Singapore` 진단 라인 추가. 본인 머신 검증 → codeburn `period: "Today (2026-05-01)"`, `daily: [{date: "2026-05-01"}]` 정상 리턴.
- **자가 치유 검증**: 본인 사용자 1명에서 `current_day_start`/`current_month_start` 4/30→5/1, period_snapshots에 daily(4/30) + monthly(4/1) promote 자동 발생. April monthly + 4/30 daily 데이터 손실 없이 회수.
- **DB 클린업**: period_snapshots에서 daily(4/30), monthly(4/1) 행 사용자 요청으로 DELETE. 다른 4명 팀원의 다음 sync에서 자가 치유 재검증 예정.
- **팀 페이지 fix** — sessionsCount==0 필터 제거 (`a770ceb`): 모든 멤버가 항상 보이도록.
- **드롭다운 UX fix** (`8e20ef9`): period 버튼 클릭 시 모든 offset 0으로 리셋(이전엔 같은 period 클릭하면 offset 유지돼서 라이브 복귀 안 됨). 라벨 통일: placeholder 모두 `이전 ▼`, items의 1번째는 자연어(`어제/지난주/지난달`), 2번째부터 `N단위전`. monthly dropdown `slice(0, 6)` 추가.
- **30일 period 추가** (`4fc5db8`): codeburn parity. CLI PERIODS에 `"30days"` 추가, Period type 확장, 버튼 `[오늘][이번주][이번달][30일][전체]`. JSONB 컬럼이라 schema 변경 0.
- **팀 stale 멤버 필터** (`f81a8dd`): "이번달" 탭에서 4/30 마지막 sync 멤버(rawJson.month=April)와 5/1 sync 멤버(rawJson.month=May)가 섞여 팀 합산이 April 41일 + May 1일이 됨. 멤버의 `daily[0].date`가 현재 month/day와 다르면 0 처리 + 활동 집계에서 제외.
- **백로그 정리**: backlog에 5/2 daily, 5/4 weekly, 6/1 monthly promote 검증 항목 (이미 추가됨)

### 다음 액션
- 다른 4명 팀원의 다음 launchd sync (12:00 SGT 등)에서 daily/monthly promote 자동 발생 확인
- 5/2 00:00+ 첫 sync 후 본인 머신의 5/1 daily promote 확인

---

## Session 2026-05-01 01:26 — boundary 계산 timezone 의존성 제거 (DB timezone NULL fix)

### 작업 요약
- **5/1 SGT 자정 sync 후 `[지난달 ▼]` 드롭다운 미등장 신고**: 4월 데이터 promote 안 됨
- **Supabase MCP 인증 + 직접 쿼리로 진단**:
  - 5명 전원 `users.timezone = NULL`
  - `current_day_start = 2026-04-30`, `current_month_start = 2026-04-01` (5/1 sync 후에도 4/30 그대로)
  - `period_snapshots` 비어있음 (promote 한 번도 안 됨)
- **원인**: ingest의 `userTz = userRow[0].timezone ?? "UTC"` → SGT 자정 sync(=UTC 16:00 4/30) 시점에 `newDayStart = "2026-04-30"`로 계산 → prev=4/30, new=4/30 boundary 미감지 → promote 스킵, 동시에 새 5/1 데이터로 `current_*_raw_json` 덮어씀
- **fix (`a4a82bf`)**: `deriveUserTodayFromBody()` 헬퍼 추가
  - 1순위: `body.today.daily[0].date` (codeburn이 사용자 로컬 시각으로 계산)
  - 2순위: `body.ccusageDaily.daily`의 max 날짜
  - 3순위: 기존 `ymdInTz(now, userTz)` 폴백
- newDayStart / newWeekStart / newMonthStart 모두 위 신호 우선 사용
- **자가 치유**: 다음 launchd sync (06:00 SGT 등)에서 prev=4/30, new=5/1(payload-derived) → boundary 감지 → 4/30 daily / April monthly promote
- 빌드/lint 통과, 커밋·푸시 완료

### 손실 (복구 안 함)
- 4/30 daily 스냅샷: 5/1 00:00 sync가 `current_day_raw_json`을 5/1 빈 데이터로 덮어쓴 후 promote 누락 → 영영 못 만듦
- April monthly 스냅샷: 같은 이유로 영영 못 만듦
- `rawJson.all.daily` + `ccusageDaily.daily`엔 4월 데이터 그대로 살아있어 "전체" 탭에선 정상 표시. 잃은 건 드롭다운 진입점만

### 다음 액션
- 5/2 00:00+ 첫 sync 후 daily promote 검증 (`[이전 ▼ → 어제(5/1)]`)
- 5/4 (월) 00:00+ 첫 sync 후 weekly promote 검증
- 6/1 00:00+ 첫 sync 후 monthly promote 검증

---

## Session 2026-04-30 15:59 — 세션 워크로그 정리 및 커밋

### 작업 요약
- worklog.md / state.md / backlog.md 갱신 (팀 화면 재구성, 한방 설치 스크립트, period localStorage 작업 기록)
- backlog 3건 완료 처리, 2건 대기로 정리
- state.md 전체 재작성
- git add → commit → push, snooze_attention 훅 실행

### 다음 액션
- 2026-05-05 첫 weekly 스냅샷 promote 검증
- 2026-05-01 첫 monthly 스냅샷 promote 검증
- 팀원 대상 install.sh/install.ps1 한방 설치 안내


## Session 2026-04-30 08:26 — 팀 화면 재구성 + 한방 설치 스크립트 + period localStorage

### 작업 요약
- **Team Activity 카드**: ccusage 기반 토큰 합계 + Top 10 표시. Usage → Cost rename, Top Sessions 제거 (`f856f13`)
- **ADMIN 배지**: nav `팀원` 탭, team Last Sync, team Top Sessions(admin 복원, `af7829f`)
- **Team aggregated 카드 신설** (`671e728`):
  - Core Tools (top 10 calls), Shell Commands (top 10 calls), By Model — 모두 멤버 합산
  - Row 4: Core Tools + Shell Commands, Row 5: By Model + 빈칸
  - 성능 분석: 현재 풀스캔 구조에서 누적 3개 추가는 ms 단위 영향. 1000명+ 시점에 별도 리팩터 필요 (모델/툴 추가가 그걸 앞당기지 않음)
- **Team Summary Bar 토큰 합계** (`6f04934`): cyan `XX.XM 총토큰` 맨 앞에 추가
- **한방 설치 스크립트** (`64ea2bf`):
  - `web/public/install.sh`: nvm으로 Node 자동 설치 → `npx ... init`
  - `web/public/install.ps1`: winget으로 Node 자동 설치 → `npx ... init`
  - Setup 페이지: NodeInstallGuide 카드 제거, Step 1을 OS-aware one-liner로 교체
  - 수동 fallback (`npx --yes ... init`)은 접이식 details에 보존
- **Period localStorage** (`1f8ebd1`):
  - team_period (default 이번달), dashboard_period (default 이번주), member_period (member + admin 팀원 상세 공유)
  - 새 페이지 마운트 시 직전 선택 복원, 클릭마다 저장. 스냅샷 offset은 저장 안 함 (의도적)

### 다음 액션
- 5월 5일(다음 주 월요일) 첫 weekly 스냅샷 promote 검증
- 5월 1일 첫 monthly 스냅샷 promote 검증

---

## Session 2026-04-30 07:51 — ccusage 토큰 통합 + 대시보드 카드 재구성

### 작업 요약
- ccusage daily --json 연동: codeburn에 일별 토큰 데이터 없음 확인 → submit.mjs/sync.ts에 토큰 4종(input/output/cacheRead/cacheWrite) 수집 추가
- init에 ccusage 자동 설치 추가 (repair 시 자동)
- Daily Activity 카드 신설 (totalTokens 막대그래프), 기존 daily → "Daily Cost"로 rename
- 카드 순서 재배치: Daily Activity/Cost → Efficiency/By Model → By Project/By Activity → Top Sessions/MCP → Core Tools/Shell
- Overview Bar에 토큰 합계 추가, 바 너비 확장 + 값 오른쪽 정렬
- codeburn 비용 오류 발견: week period가 rolling 7일이라 경계일(4/22) cost 잘림 ($7.10 vs 실제 $117) → Daily Cost와 Overview cost를 ccusage 출처로 교체, Efficiency cost/session·cost/call 자동 교정
- 스냅샷에 ccusage 포함: promote 시 ccusageDaily를 주/월 범위 필터링해 rawJson에 동봉 → 지난주/지난달에서도 토큰 그래프 표시
- Weekly retention 50주 → 10주 축소
- Daily 스냅샷 신설: 어제~7일전 드롭다운 추가 (migration 0002 필요)

### 다음 액션
- Supabase에서 0002 마이그레이션 SQL 실행

---

## Session 2026-04-30 05:46 — Supabase RLS 보안 경고 확인

### 작업 요약
- Supabase 보안 경고 수신 — `public` 스키마 테이블에 RLS 미설정, anon key로 누구나 데이터 접근 가능한 상태 확인

### 다음 액션
- RLS 미설정 테이블 식별 → `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` 적용
- 접근 정책(Policy) 정의 (service_role 전체 접근, anon 차단 등)
- 5월 1일 monthly 스냅샷 promote 검증


## Session 2026-04-30 05:46 — Supabase RLS 보안 경고 확인

### 작업 요약
- Supabase 보안 경고 수신 — `public` 스키마 테이블에 Row-Level Security(RLS) 미설정 확인
- RLS 꺼져 있어 `anon` key로 누구나 데이터 읽기/쓰기/삭제 가능한 상태

### 다음 액션
- RLS 미설정 테이블 식별 (Supabase 대시보드 또는 코드 기반 확인)
- `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` 적용
- 접근 정책(Policy) 정의 — service_role 전체 접근, anon 차단 또는 인증 사용자만 자기 데이터

---

## Session 2026-04-29 15:59 — 세션 워크로그 기록 및 상태 갱신

### 작업 요약
- `.harness/worklog.md`, `state.md` 갱신 (state.md는 122라인에서 잘려 Write로 전체 재작성)
- 변경사항 git add → commit → push, snooze_attention.sh 실행

### 다음 액션
- repair 재실행으로 즉시 수집 검증
- 다음 주 월요일 첫 weekly 스냅샷 promote 검증
- 5월 1일 첫 monthly 스냅샷 promote 검증


## Session 2026-04-29 13:59 — repair 시 즉시 데이터 수집 추가

### 작업 요약
- `cli/src/init.ts`에 `runImmediateSync()` 함수 추가 — STABLE_SUBMIT 경로의 `submit.mjs`를 detached 백그라운드로 spawn
- `_USAGE_TRACKER_DETACHED=1` 플래그 주입해 self-detach 1단계 건너뛰고 본 작업 즉시 진입
- `runRepair()`에서 `registerDailySchedule` 직후 `runImmediateSync(apiKey)` 호출
- `bun run build` (build:index + build:sync + build:init 3개 모두 재빌드) — `index.mjs` 45.12KB 산출, "즉시 수집" 문자열 3회 포함 확인
- 커밋 `bc6c29f` 푸시

### 다음 액션
- 사용자가 repair 재실행으로 즉시 수집 동작 검증
- 검증되면 팀원 대상 repair 명령 공유

---

## Session 2026-04-29 10:46 — 세션 종료 후 워크로그/하네스 파일 정리 및 커밋

### 작업 요약
- `worklog.md`, `state.md`, `decision.md`, `backlog.md` 업데이트
- 완료된 스크롤바 항목을 backlog에서 완료/취소로 이동
- `.harness` 파일 전체 git commit & push

### 다음 액션
- Supabase에서 `current_week` / `month_start` 필드 채워지는지 확인
- 첫 weekly 스냅샷 promote 검증 (다음 월요일)
- 첫 monthly 스냅샷 promote 검증 (5월 1일)


## Session 2026-04-29 08:46 — 주별/월별 스냅샷 누적 기능 구현

### 작업 요약
- **데이터 수집 검증 완료**: 06:00 launchd 자동 실행으로 데이터 도착 확인 (PC 켜져 있을 때 검증, 사용자 보고)
- **Daily Activity 카드**: 45건 임계 + `↕ scroll · N` cyan 배지 + `no-scrollbar` 적용 (커밋 `e523de0`)
- **스크롤바 숨김 일괄 적용**: globals.css에 `.no-scrollbar` 유틸 추가, dashboard-view.tsx 5곳(projects/activities/tools/shellCommands/mcpServers) 적용
- **주차 표시 기간 조사**: codeburn `--period week` = "Last 7 Days" rolling 7일 (캘린더 주 아님)
- **지난주 보기 설계 논의**: rolling 7d 한계로 일~금 정확 매칭 불가 → "주별 스냅샷 누적" 방식 확정
- **스펙 확정**:
  - 캘린더 주 = 월요일 시작
  - 드롭다운: 1주전~10주전 / 1달전~6달전, 가용한 만큼만 메뉴 항목
  - 보관: 50주 / 12달
  - 캡처 정책: 항상 캡처, 캡처 시간 + 데이터 범위 표시 (사용자 판단)
  - Monthly: 옵션 A (정확도 우선, current_month_raw_json 보존 후 promote)
  - 타임존: 사용자별 timezone 컬럼 기준, SGT/KST 표시
- **codeburn 검증**: `--period month` = "April 2026" 캘린더 월 확인 → 옵션 A 가능
- **DB 스키마**: `period_snapshots` 테이블 신설 + `user_snapshots`에 4컬럼 추가 (`current_week_*`, `current_month_*`)
- **마이그레이션 SQL**: `web/drizzle/0001_period_snapshots.sql` 작성 + Supabase 수동 실행 (사용자 검증 완료, period_snapshots 6컬럼 + current_* 4컬럼 확인)
- **Ingest 로직**: 사용자 timezone 기반 ISO 월요일/1일 계산, 경계 감지 시 직전 데이터를 period_snapshots로 promote, 50주/12달 retention DELETE
- **Dashboard API**: `weekOffset` / `monthOffset` 파라미터, `availableSnapshots` + `snapshot` 메타 응답 추가
- **UI**: 이번주/이번달 활성 시 드롭다운 표시, 스냅샷 선택 시 indigo 활성 표시 + 라이브 버튼은 항상 클릭 가능, 마지막 수신 영역에 `📌 captured ... KST · M/D-M/D` 표시
- **빌드 통과 + lint 통과**, 커밋 `6e42db2` 푸시

### 다음 액션
- 다음 sync에서 `current_week_start` / `current_month_start` 채워지는지 Supabase 확인
- 다음 주 월요일 첫 sync로 첫 weekly 스냅샷 promote 확인 → `[지난주 ▼]` 드롭다운 등장
- 5월 1일 첫 sync로 첫 monthly 스냅샷 promote 확인 → `[지난달 ▼]` 드롭다운 등장

---

## Session 2026-04-29 07:56 — 스크롤바 숨김 처리 (스크롤 동작 유지)

### 작업 요약
- 스크롤바가 보이는 UI 문제 발견, CSS로 숨기는 방법 검토
- 코드베이스에서 스크롤 관련 클래스(`overflow-y-auto`, `overflow-auto`) 위치 파악

### 다음 액션
- grep 결과 확인 후 해당 위치들에 스크롤바 숨김 스타일 일괄 적용


## Session 2026-04-28 22:45 — 세션 종료 워크로그 기록 및 커밋

### 작업 요약
- `worklog.md`, `state.md` 업데이트 후 git commit & push
- `snooze_attention` 훅 실행으로 알림 스누즈 처리

### 다음 액션
- 내일 06:00 자동 실행 후 수집 데이터 확인
- 팀원에게 repair 명령 공유


## Session 2026-04-28 20:43 — 데이터 수집 파이프라인 E2E 검증 완료

### 작업 요약
- **`589ed52` 적용 후 repair 재실행**: API 키 fallback 파일 (`~/.primus-usage-key`) 정상 재작성 확인
- **`launchctl kickstart -k`로 즉시 실행 검증**: Vercel `/api/ingest 200` 도착 확인 (사용자 확인)
- **3가지 수정 모두 동시 동작 확인**:
  1. SessionStart/SessionEnd hook 제거
  2. launchd plist `EnvironmentVariables` PATH 주입 (codeburn 인식)
  3. repair 시 `~/.primus-usage-key` 재작성 (submit.mjs standalone keytar 부재 대응)
- 06:00 launchd 자동 실행 검증은 내일 아침 확인 예정

### 다음 액션
- 내일 아침 06:00 자동 실행으로 들어온 데이터 확인
- 검증되면 팀원들에게 repair 명령 공유

---

## Session 2026-04-28 20:26 — repair 후 submit.mjs API 키 미전달 버그 수정

### 작업 요약
- **원인 파악**: `~/.primus-usage-key` 파일 없음 → submit.mjs의 `loadApiKey()` null 반환 → 조용히 종료
- **배경**: submit.mjs는 standalone 실행이라 keytar 없음. repair는 keytar로 키 확인만 하고 fallback 파일 재작성 안 함
- **수정**: `runRepair`에서 API 키 확인 후 `~/.primus-usage-key` 파일도 재작성하도록 추가
- **빌드·커밋·푸시**: `cli/src/init.ts`, `cli/src/index.mjs` → commit `589ed52`

### 다음 액션
- repair 재실행 후 kickstart로 검증

---

## Session 2026-04-28 20:17 — launchd PATH 누락으로 codeburn 미실행 버그 수정

### 작업 요약
- **18:00 ingest 공백 확인**: launchd가 18:00에 실행됐으나 Vercel 로그 없음
- **원인 파악**: `launchctl print`로 launchd 환경 확인 → `PATH=/usr/bin:/bin:/usr/sbin:/sbin`만 있어 `.nvm` 경로 없음 → codeburn 못 찾음
- **수정**: `registerLaunchd()` plist에 `EnvironmentVariables` 블록 추가 — `process.env.PATH` (설치 시점 사용자 셸 PATH 전체) 주입
- **빌드·커밋·푸시**: `cli/src/init.ts`, `cli/src/index.mjs` rebuild → `95ec4e1` push
- **repair 재실행**: 새 plist에 `.nvm` 경로 포함된 PATH 확인
- **launchctl kickstart -k**: 즉시 강제 실행으로 수정 검증 시작 (Vercel 로그 결과 대기 중)

### 다음 액션
- Vercel `/api/ingest 200` 로그 확인으로 PATH 수정 검증
- 확인 후 팀원들에게 repair 명령 공유 (내일)

---

## Session 2026-04-28 20:12 — launchd Python 경로 오류로 인한 데이터 수집 중단 수정

### 작업 요약
- launchd 등록 상태 확인 (4개 plist 모두 등록됨)
- 수집 중단 원인 파악: plist에서 시스템 `python3` 사용으로 `anthropic` 모듈 못 찾음
- 4개 plist 파일의 Python 경로를 pyenv 전체 경로로 수정
- launchd unload → load로 재등록 후 수동 테스트로 정상 동작 확인

### 다음 액션
- 이후 15분 주기 실행(16:30, 16:45 등)에서 자동 수집이 정상적으로 이루어지는지 모니터링


## Session 2026-04-28 18:01 — decision.md 확정 및 워크로그 커밋/푸시

### 작업 요약
- `decision.md` 최종 결정 내용으로 업데이트
- worklog/state/decision 파일 커밋 & 푸시

### 다음 액션
- 팀원들에게 repair 명령 공유 (`npx ... repair`)


## Session 2026-04-28 15:59 — worklog.md 업데이트 및 프로젝트 설정 확인

### 작업 요약
- `.claude/settings.json` 프로젝트 설정 파일 읽기 및 `permissions defaultMode` 값 확인
- `worklog.md` 파일 라인 수 확인 후 내용 업데이트


## Session 2026-04-28 15:57 — SessionStart/SessionEnd hook 제거 → launchd 단독 수집 전환

### 작업 요약
- **Hook 동작 원리 Q&A**: VSCode 종료/+ 버튼/X 버튼 별 SessionStart·SessionEnd 트리거 조건 정리
- **Vercel 로그 분석**: 3:43 + / X 동작 후 ingest 공백 확인 (15:09 이후 로그 없음)
- **원인 분석**: SessionStart + SessionEnd 동시 발화 → lock 충돌 구조적 문제, codeburn "Today (2026-04-27)" period 레이블 버그 확인
- **결정**: SessionStart/SessionEnd hook 완전 제거, launchd 4회/일(0/6/12/18시) 단독 수집으로 전환
- **`cli/src/init.ts` 수정**:
  - `mergeHook` → `removeHook` (hook 추가 대신 기존 submit.mjs 항목 제거)
  - `runRepair`: 즉시 수집 블록 제거, removeHook 호출로 전환
  - `runInit`: 동일하게 mergeHook → removeHook
- **빌드 1차**: `bun build src/init.ts` → `init.mjs` 재빌드, push
- **repair 재실행 → 구버전**: `index.mjs`가 `init.ts`를 인라인 번들한 파일임을 파악 — build:index 미실행이 원인
- **빌드 2차**: `bun build src/index.ts` → `index.mjs` 재빌드, push
- **repair 정상 확인**: settings.json에서 SessionStart/SessionEnd submit.mjs 항목 제거됨, launchd 활성 확인
- 내일 팀원들에게 repair 명령 배포 예정

### 실패한 시도
- init.mjs만 빌드하고 index.mjs 미빌드 → repair 실행 시 구버전 동작 (SessionStart/SessionEnd 재등록)

### 다음 액션
- 팀원들에게 `npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker repair` 공유 (내일)

---

## Session 2026-04-28 14:42 — 팀 화면 Last Sync 테이블 추가 (어드민 전용)

### 작업 요약
- **팀 화면 맨 아래 Last Sync 카드 추가**: 전체 팀원 마지막 수신 시각 테이블, 반 셀 너비
- **정렬**: 가장 오래된 수신 순 (문제 있는 멤버 상단)
- **경고 색상**: 5일↑ 빨간 `⚠N일`, 2일↑ 노란 `N일전`, 정상 흰색
- **버그 수정**: 클라이언트 `isAdmin()` 오작동 — `process.env.ADMIN_EMAIL`은 non-NEXT_PUBLIC_ 변수라 client bundle에서 undefined → 하드코딩 기본값으로 폴백 → Vercel ADMIN_EMAIL 환경변수 미반영
- **수정**: `isAdmin` 체크를 `/api/team` 서버 사이드로 이동, 응답에 `isAdminUser: boolean` 추가
- 배포 및 동작 확인 완료

### 실패한 시도
- 첫 배포 후 테이블 미표시 — 원인: 클라이언트 `isAdmin()` 오작동 (위 버그)

### 다음 액션
- 없음 (신규 요청 대기)

---

## Session 2026-04-28 14:09 — 데이터 수집 신뢰성 전면 개선 + 어드민 팀원 메뉴 추가

### 작업 요약
- **어드민 팀원 메뉴 추가**: nav.tsx에 어드민 전용 "팀원" 탭 추가 (팀~셋업 사이)
- **dashboard-view.tsx**: `onMemberSelect` prop 추가 — 페이지 이동 없이 상태 업데이트
- **`/member/page.tsx` 신규 생성**: `localStorage`로 마지막 선택 팀원 기억
- **`/team/[userId]/page.tsx`**: "자세히 보기" 버튼 제거
- **launchctl 수정**: macOS Sequoia에서 deprecated `load/unload` → `bootstrap/bootout` 으로 교체
- **launchd 스케줄 4회로 확장**: 9시 1회 → 0/6/12/18시 4회 (최대 6시간 지연 보장)
- **repair 명령 추가**: API 키 유지한 채 hook·스케줄만 재등록 + 즉시 데이터 수집
- **SessionStart hook 추가**: VS Code 열 때도 수집 (SessionEnd만으로는 세션 미종료 팀원 누락)
- **CLI 빌드 재실행**: `bun run build` 후 `repair` 명령 포함 번들 확인
- **팀원 공유 명령 확정**: `npx --yes --ignore-cache github:eugene-eee-hongkyu/ai-usage-tracker repair`
- **검증 완료**: launchd 4회 등록 확인, DB updated_at `2026-04-28 06:01 UTC` (즉시 수집 PASS)
- **~/.claude/settings.json 변경**: SessionStart hook 등록 (submit.mjs)

### 실패한 시도
- plist 자동 생성 버그: 기존 `index.mjs` 번들이 구버전 (registerDailySchedule 미포함) → 수동 plist 생성 후 `bun run build` 재빌드

### 다음 액션
- 없음 (팀원들에게 repair 명령 공유 후 대기)

---

## Session 2026-04-28 13:44 — 자동 수집(9시) 미작동 버그 원인 파악

### 작업 요약
- LaunchAgents에 plist 파일 존재 여부 확인
- launchctl 등록 상태 확인
- `init.ts` / `init.mjs` 내 스케줄 등록 로직 분석
- **원인 파악**: `~/Library/LaunchAgents/`에 plist 파일 없음 + launchd 미등록 → 자동 수집 스케줄이 실제로 설치되지 않은 상태임을 확인

### 다음 액션
- `init.mjs`의 `registerDailySchedule` 등 스케줄 등록 로직 상세 분석
- plist 생성 및 launchctl 등록 흐름 수정


## Session 2026-04-28 10:43 — 워크로그/상태 파일 업데이트 및 커밋

### 작업 요약
- 설정 파일, `state.md`, `worklog.md` 읽어 현재 세션 상태 확인
- `worklog.md`, `state.md` 업데이트 (2026-04-28 세션 기록)
- 변경 파일 git add → commit → push
- `snooze_attention` 훅 실행으로 세션 마무리 처리


## Session 2026-04-28 08:40 — 어드민 전용 팀원 메뉴 추가 및 자세히 보기 버튼 제거

### 작업 요약
- **요구사항 파악**: 코드 구조 탐색 후 변경 범위 확인 (nav, team/[userId], DashboardView, team/[userId]/dashboard)
- **nav.tsx 수정**: `isAdmin()` 체크로 어드민에게만 "팀원" 탭 표시 (팀~셋업 사이)
- **dashboard-view.tsx 수정**: `onMemberSelect` 옵션 prop 추가 — 페이지 이동 없이 상태 업데이트 가능
- **`/member/page.tsx` 신규 생성**: 어드민 전용, `localStorage` 키 `teamMemberSelectedUserId`로 마지막 선택 팀원 기억, 미선택 시 본인 표시
- **`/team/[userId]/page.tsx` 수정**: `canViewFullDashboard` 및 "자세히 보기" 버튼 제거
- **커밋·푸시**: `bce7bfe`

### 다음 액션
- 없음 (신규 요청 대기)

---

## Session 2026-04-28 08:07 — 어드민 팀원 상세 화면 메뉴 재배치 설계

### 작업 요약
- 현재 코드 구조 파악 (파일/디렉토리 탐색)
- 어드민 팀원 상세 화면 메뉴 재배치 요구사항 이해 확인 시도

### 다음 액션
- Claude 요구사항 재설명 및 검토
- 실제 메뉴 재배치 구현 작업 진행


## Session 2026-04-27 20:50 — 세션 종료 워크로그 기록 및 커밋

### 작업 요약
- `.harness/worklog.md`, `state.md` 작성
- git commit & push 완료
- `snooze_attention` 훅 실행으로 세션 마무리 처리

---


## Session 2026-04-27 18:49 — reading-guide 초안 생성·검증·적용

### 작업 요약
- **README.md 업데이트**: By Member 차트 설명 수정(stacked → 독립 렌더링), ADMIN_EMAIL 환경변수 추가
- **`/reading-guide-init` 실행**: `docs/` 4개 파일 분류 후 `docs/reading-guide.md` 생성
  - 포함: 03_A-2, 05_B-1 (설계 의도), codeburn-migration_run (실행 기록)
  - 제외: favicon/README.md (how-to)
  - `.gitignore`에 `docs/drift-report.md` 추가
- **`/reading-guide-verify` 실행**: 검토 필요 4개, 일치 확인 7개, 검증 불가 3건 식별
  - `docs/verify-report.md` 생성
  - `docs/drift-report.md` 생성
- **`/reading-guide-apply` 실행**: drift-report 3개 항목 모두 적용
  - A-2 "읽어야 할 이유" 어긋난 UX 서술 수정 + ⚠ 경고 노트 추가
  - B-1 ccusage→codeburn 원칙 중립화 + ⚠ 경고 노트 추가
  - "문서에 없는 현재 기능" 섹션 추가 (어드민 뷰어·Google OAuth·타임존·일일 동기화)
- **커밋**: `6b854c2` (reading-guide, verify-report, README, .gitignore)

### 다음 액션
- 없음 (신규 요청 대기)

---

## Session 2026-04-27 18:04 — 프로덕션 배포 검증 완료

### 작업 요약
- **Vercel ADMIN_EMAIL env var 설정 완료** (프로덕션 관리자 버튼 활성화)
- **팀원 초대 및 팀 화면 검증 완료**: Mac 3명 + Windows 1명 (총 4명)
- **Windows SessionEnd hook 발화 검증 완료**: 정상 동작 확인
- **재설치 검증 완료**: `rm -rf ~/.primus-usage-tracker` → `npx init` 플로우 확인

### 다음 액션
- 없음 (현재 모든 계획된 마일스톤 완료)

---

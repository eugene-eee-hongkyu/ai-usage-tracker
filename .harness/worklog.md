# worklog.md — 작업 기록

> 최신 세션이 위에 오도록 역순으로 작성한다.

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

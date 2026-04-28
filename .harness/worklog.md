# worklog.md — 작업 기록

> 최신 세션이 위에 오도록 역순으로 작성한다.

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

# worklog.md — 작업 기록

> 최신 세션이 위에 오도록 역순으로 작성한다.

---

## Session 2026-04-26 07:25 — `ALLOWED_EMAIL_DOMAIN` 멀티 도메인 설정 방법 확인

### 작업 요약
- `ALLOWED_EMAIL_DOMAIN` 환경변수의 다중 도메인 허용 방법 확인
- 코드베이스에서 해당 변수 처리 로직 검색
- 쉼표 구분자 지원 확인 → `ALLOWED_EMAIL_DOMAIN=primuslabs.gg,gmail.com` 형식으로 설정 가능


## Session 2026-04-26 04:08 — 워크로그/상태 파일 정리 및 커밋

### 작업 요약
- worklog.md, state.md 갱신 후 git commit & push
- 5h utilization 기능 미구현 확정 → 백로그 미등록

### 다음 액션
- 프로덕션 URL 팀 공유
- Windows SessionEnd hook 검증
- UX 버그 수집


## Session 2026-04-26 02:07 — 팀랭킹 탭 전환 dimming 추가 + 5h utilization 보류 결정

### 작업 요약
- **팀랭킹 탭 전환 dimming 구현**: `team/page.tsx`에 `loading` 상태 추가 → 탭 전환 시 `opacity-40 pointer-events-none` 적용 (대시보드와 동일 패턴)
- **5h utilization 카드 논의**: API vs Max/Pro 플랜 구분 가능성 검토
  - ccusage JSONL에 플랜 정보 없음 — `costUsd` 간접 신호는 신뢰도 낮음
  - `activeHours`가 `submit.mjs`에서 하드코딩 0 → 데이터 자체 없음
  - **결론: 구현 안 함** (사용자 명시 결정)

### 다음 액션
1. 팀원에게 `https://ai-usage-tracker-web-psi.vercel.app` 공유 및 초대
2. B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 — SessionEnd hook 발화 검증
3. 프로덕션 사용 중 발견되는 UX 버그 수집 및 수정

---

## Session 2026-04-26 01:59 — 최고 효율 지표 교체 및 셋업 상태 버그 수정

### 작업 요약
- **최고 효율 계산식 전면 교체** (oneShotRate → cache hit% × 100 / 세션당 비용):
  - `lib/rules/index.ts`: `computeTodayMvpScore(tokens, oneShotRate)` → `computeEfficiencyScore(cacheRead, cacheWrite, totalCost, sessionsCount)`, `generateMvpBlurb` 시그니처도 `cacheHitPct + costPerSession` 인자로 교체
  - `api/team/route.ts`: cacheRead/cacheWrite 집계 추가, efficiencyScore·cacheHitPct·costPerSession 반환, `byEfficiency` / MVP 정렬 기준 모두 새 점수로 교체
  - `team/page.tsx`: MemberStat 타입 교체, 최고 효율 목록에 점수 + `cache XX%·$YY` 분해 표시, MVP 카드 subline도 교체
- **셋업 상태 API 버그 수정** (`/api/setup/status`):
  - `steps` 반환형을 배열 → 객체(`{ cli_installed, hook_registered, first_session }`)로 수정 (페이지 기대값과 불일치로 전부 빈 칸 표시되던 버그)
  - `sessionsCount`, `lastSyncedAt` 필드 누락 추가 (배너에 "세션 undefined개", "마지막 수집: 없음" 표시되던 버그)

### 다음 액션
1. 팀원에게 `https://ai-usage-tracker-web-psi.vercel.app` 공유 및 초대
2. B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 — SessionEnd hook 발화 검증
3. 프로덕션 사용 중 발견되는 UX 버그 수집 및 수정

---

## Session 2026-04-26 01:44 — 지표 팝업 모달 추가 및 컨텍스트 압박률 제거

### 작업 요약
- **컨텍스트 압박률 카드 완전 제거**: 원샷 성공률도 `oneShotEdits`/`totalEdits`가 `submit.mjs`에서 하드코딩 0이라 사용 불가 확인 → 대안 없이 제거 결정
- **Cache hit 상세 모달 추가**: "올리는법" 버튼 + 숫자(95%) 클릭 → 팝업
  - 캐시 원리 설명, 올리는 방법 5가지, 등급표(현재 위치 하이라이트)
- **세션당 평균 비용 상세 모달 추가**: "줄이는법" 버튼 + 숫자($49.xx) 클릭 → 팝업
  - 계산식(실제 값 표시), 줄이는 방법 5가지, Sonnet 기준 등급표
- **UX 반복 수정**:
  - 전체 카드 클릭 → 제목 옆 인라인 버튼 + 숫자만 클릭으로 변경
  - 기존 간단 설명 텍스트 복원 (제거됐던 것)
- `web/src/components/metric-modal.tsx` 신규 생성 (301줄)

### 다음 액션
1. 팀원에게 `https://ai-usage-tracker-web-psi.vercel.app` 공유 및 초대
2. B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 — SessionEnd hook 발화 검증
3. 프로덕션 사용 중 발견되는 UX 버그 수집 및 수정

---

## Session 2026-04-26 01:29 — 대시보드 효율 지표 개선 (출력밀도 제거 + 신규 지표 추가)

### 작업 요약
- 이전 세션 worklog/state.md 커밋·푸시로 세션 마무리
- 출력밀도 카드 제거, 세션당 평균 비용·컨텍스트 압박률 카드 추가 구현
- Vercel 빌드 실패(`inputTokens`/`outputTokens` 미사용 변수) → 즉시 수정 재푸시

### 실패한 시도
- 컨텍스트 압박률 공식 오류: `cacheRead / sessions / 200K`로 계산 시 턴마다 누적되는 값이라 수백%가 나오는 근본적 오류 발생
- DB에 "세션 종료 시점의 컨텍스트 크기" 데이터가 없어 정확한 압박률 산출 불가

### 다음 액션
- 컨텍스트 압박률 대체 지표 결정: 원샷 성공률 또는 세션당 캐시 쓰기(M) 중 선택 후 구현


## Session 2026-04-25 23:28 — Setup 페이지 Node.js 설치 안내 추가

### 작업 요약
- **Setup 페이지 Node.js 설치 가이드 추가**: 브라우저 OS 감지(`navigator.userAgent`)로 Mac/Windows 분기
  - Mac: `.pkg` 다운로드 안내 + "Node.js 다운로드 (LTS) →" 버튼 → nodejs.org/ko/download
  - Windows: `.msi` 다운로드 안내 + 동일 버튼
  - "Node.js 이미 설치됨 — 다음 단계로" 버튼으로 섹션 닫기
  - 기존 설치 유저는 버튼 한 번으로 스킵 가능
- **확인 사항**: ccusage는 `npx ccusage` 방식으로 실행되므로 별도 설치 불필요 — npx가 자동 처리
- **확인 사항**: ccusage는 Claude Code(CLI) 사용량만 수집 — claude.ai(웹) 사용량은 수집 불가

### 다음 액션
1. 팀원에게 `https://ai-usage-tracker-web-psi.vercel.app` 공유 및 초대
2. B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 — SessionEnd hook 발화 검증
3. 프로덕션 사용 중 발견되는 UX 버그 수집 및 수정

---

## Session 2026-04-25 22:25 — Google OAuth, Setup UX 수정, 브랜딩 정리, README 작성

### 작업 요약
- **Google OAuth 추가**: GoogleProvider 등록, 로그인 버튼 추가, 동일 이메일이면 GitHub/Google 계정 공유 (DB row 유지)
- **Setup 페이지 즉시 fetch**: 마운트 시 2초 대기 없이 poll 즉시 실행 → 이미 설치된 유저가 체크박스 ⏳로 보이던 문제 해결
- **Setup 페이지 자동 리다이렉트 제거**: `ready: true` 시 대시보드 강제 이동 → "대시보드로 가기" 버튼으로 교체 (상태 확인 후 본인이 이동)
- **primuslabs 브랜딩 제거 (임팩트 없는 곳만)**:
  - `login/page.tsx`: "Primus Labs 멤버 전용" → "팀 멤버 전용"
  - `layout.tsx`: 탭 제목/설명 일반화
  - `auth.ts`: 주석 도메인 예시 일반화
  - `setup-status/page.tsx`: npx 명령어 4곳 → `eugene-eee-hongkyu/ai-usage-tracker`
  - `package.json` (루트+cli), `cli/src/index.mjs`: description 일반화
  - keytar 서비스명, STABLE_DIR, 설치 경로 — 기존 설치 유지 위해 변경하지 않음
- **README.md 작성**: Vercel+Supabase 배포 가이드, CLI 설치, 로컬 개발, 기술 스택, Supabase 주의사항 포함

### 다음 액션
1. 팀원에게 `https://ai-usage-tracker-web-psi.vercel.app` 공유 및 초대
2. B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 — SessionEnd hook 발화 검증
3. 프로덕션 사용 중 발견되는 UX 버그 수집 및 수정

---

## Session 2026-04-25 21:48 — 프로덕션 로그인 연결 디버깅 및 UX 개선

### 작업 요약
- **프로덕션 DB 연결 3단계 디버깅**:
  1. `ENOTFOUND db.ifgncizkzojddguxwksd.supabase.co` → Supabase direct URL은 Vercel(IPv4) 에서 DNS 실패 → Transaction Pooler + IPv4 Shared Pooler URL로 교체
  2. `password authentication failed for user "postgres"` → URL 직접 파싱 시 `postgres.ifgncizkzojddguxwksd` 유저명 처리 오류 → `connectionString` 직접 전달로 수정
  3. 비밀번호 특수문자 (`!`, `@`) URL 인코딩 필요 → `%21`, `%40`으로 인코딩 후 Vercel 환경변수 업데이트
- **auth.ts try/catch 추가**: DB 에러가 `Headers.set` 500으로 뻗는 버그 수정 → `/login?error=db` 클린 리디렉트
- **db/index.ts SSL 수정**: localhost 외 환경에서 SSL 자동 활성화
- **프로덕션 GitHub 로그인 성공** → 대시보드 데이터 정상 표시 확인
- **CLI init 프로덕션 연결 성공**: `npx github:eugene-eee-hongkyu/ai-usage-tracker init` → API 키 발급, hook 등록, 백그라운드 백필 완료
- **dashboard neverSynced UX 개선**: "데이터 수집 중..." 화면 + 4초 polling으로 자동 전환
- **탭 전환 로딩 UX 개선**: period 탭 전환 시 `opacity-40 + pointer-events-none`으로 stale data dimming

### 실패한 시도
- `db/index.ts` URL 수동 파싱 방식 → Supabase pooler 유저명(`postgres.ifgncizkzojddguxwksd`) 잘못 처리 → `connectionString` 직접 전달로 교체
- SSL 조건을 `sslmode=require` URL 파라미터로만 체크 → Supabase URL에 파라미터 없으면 SSL 비활성화 → hostname 기반 자동 활성화로 변경

### 다음 액션
1. 팀원 초대 및 다른 멤버 데이터 수집 확인
2. B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 — SessionEnd hook 발화 검증
3. 필요 시 추가 UI 피드백 반영

---

## Session 2026-04-25 21:10 — 대시보드 UI 버그 수정 및 B-2 Vercel+Supabase 배포 완료

### 작업 요약
- **대시보드 UI/UX 버그 수정 (6배치)**:
  - 차트 x축 날짜 정렬 오류 → `ORDER BY date ASC` 추가
  - 오늘 그래프 어제 데이터 표시 버그 → UTC 시프트 문제, `localDateStr()` 헬퍼 추가
  - 토큰 수 크게 낮게 표시 (11.7M vs 2.375B) → cacheRead/cacheWrite 누락, `totalTokens = input+output+cache` 전체 합산으로 수정
  - 출력밀도 항상 0% → 분모를 `totalTokens`(캐시 포함) 대신 `inputTokens+outputTokens`로 수정
  - 전체 기간 활성일수 30/30일 → `allDayRange` 첫 레코드 날짜~오늘 기준으로 수정
  - one-shot 측정 불가 지표 제거 → 캐시히트/평균일비용/캐시절감/출력밀도/활성일수 5개 지표로 교체
  - 플랫폼 평균 비교 추가 (↑높음/↓낮음/비슷)
- **절감 제안 룰 버그 수정**:
  - `mcp_unused` 룰 삭제 (ccusage 데이터로 MCP 감지 불가 — 무조건 발화)
  - `low_utilization` 룰에 `activeHours > 0` 가드 추가 (하드코딩 0으로 항상 발화)
- **더보기 페이지 개선**: 각 제안 유형별 rich 설명 + 기본 펼침 + localStorage 상태 유지
- **Vercel + Supabase 배포 (B-2)**:
  - Supabase 프로젝트 생성 (ifgncizkzojddguxwksd.supabase.co)
  - drizzle-kit push 무응답 → SQL Editor에서 4개 테이블 직접 생성
  - Vercel 배포 성공 (ai-usage-tracker-web-psi.vercel.app)
  - 환경변수 설정: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GITHUB_CLIENT_ID/SECRET, ALLOWED_EMAIL_DOMAINS
- **프로덕션 설정 완료**:
  - GitHub OAuth App 콜백 URL + 홈페이지 URL → Vercel 도메인으로 업데이트
  - Vercel `NEXTAUTH_URL` → `https://ai-usage-tracker-web-psi.vercel.app`으로 업데이트
  - CLI 소스 기본 SERVER_URL `usage.primuslabs.gg` → `ai-usage-tracker-web-psi.vercel.app`으로 교체
  - `cli/bin/cli.mjs` 재번들 후 커밋·푸시

### 실패한 시도
- drizzle-kit push — spinner 후 무응답, 테이블 미생성 (DB 초기화 중 unhealthy 상태 추정) → SQL Editor 직접 실행으로 우회
- zsh에서 `DATABASE_URL="...!..."` 환경변수 설정 시 `!` 히스토리 확장 오류 → 싱글 쿼트로 해결
- `bun build cli/src/init.mjs cli/src/submit.mjs --outdir cli/bin` → `.js`로 출력, 기존 `cli.mjs` 단일 번들 구조와 불일치 → `bun build cli/src/index.mjs --outfile cli/bin/cli.mjs`로 재빌드

### 다음 액션
1. 프로덕션 GitHub 로그인 테스트 (`https://ai-usage-tracker-web-psi.vercel.app`)
2. CLI init 프로덕션 연결 검증 (`npx github:eugene-eee-hongkyu/ai-usage-tracker init`)
3. B-1 §3 Hold 플래그: Windows 환경 친구 1명 확보 — SessionEnd hook 발화 검증

---

## Session 2026-04-25 19:15 — CLI npx 실행 오류 수정 및 UX 개선

### 작업 요약
- **UX 수정 (이전 세션 피드백 반영)**:
  - `dashboard/page.tsx`: `lastSyncedAt === null`이면 차트 전체 숨기고 "CLI 설치하기" CTA만 표시
  - `setup/page.tsx`: Step 1(인디고 카드, 명령어+복사 버튼 강조) / Step 2(상태 폴링) 2단 레이아웃으로 전면 개편
  - `auth.ts`: 단일 도메인 → 다중 도메인 지원 (`ALLOWED_EMAIL_DOMAINS=a.com,b.com`)
- **CLI npx 오류 수정 3단계**:
  1. root `package.json`에 `bin` 엔트리 없음 → `"bin": { "ai-usage-tracker": "./cli/src/index.mjs" }` 추가
  2. CLI TypeScript → `.mjs` 전환 (`init.mjs`, `reset.mjs`, `sync.mjs`, `index.mjs`) — 빌드 불필요
  3. `commander` 패키지 누락 → bun으로 번들, JS 의존성 인라인, `keytar`만 외부 → `cli/bin/cli.mjs` 커밋
- **.gitignore 정리**: `.playwright-mcp/`, `verify-*.png` 추가
- 4회 커밋·푸시 완료

### 다음 액션
1. CLI 전체 플로우 검증
2. §10 시나리오 2: SessionEnd hook 발화 확인
3. B-2: Vercel + Supabase 배포

---

## Session 2026-04-25 18:17 — B-1 MVP 전체 빌드 완료 및 깃허브 푸시

### 작업 요약
- B-1 §5 빌드 순서 20단계 중 [13/20]부터 이어서 완료 (53개 파일 커밋·푸시)

### 다음 액션
- §10 시나리오 1·2 검증 후 B-2 진입

---

## Session 2026-04-25 17:42 — B-1 빌드 사전 준비 완료 및 bypassPermissions 전환

### 작업 요약
- `/harness-init`, `/context-init` 실행, B-1 §1 체크리스트 완료, bypassPermissions 전환

---

## Session 2026-04-25 17:16 — GitHub 초기 푸시 및 하네스 초기화

### 작업 요약
- `docs/` 첫 커밋 푸시, `gh repo create`, `/harness-init` 실행

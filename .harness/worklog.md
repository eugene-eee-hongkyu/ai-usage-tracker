# worklog.md — 작업 기록

> 최신 세션이 위에 오도록 역순으로 작성한다.

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
  - Vercel `NEXTAUTH_URL` → `https://ai-usage-tracker-web-psi.vercel.app`로 업데이트
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
     - `init.mjs`: `submit.mjs`를 `~/.primus-usage-tracker/`에 복사 설치 (npx 캐시 로테이션 대응)
     - `sync.mjs`: 직접 실행 모드 지원 (백그라운드 백필)
  3. `commander` 패키지 누락 (`Cannot find package 'commander'`) → bun으로 번들, JS 의존성 인라인, `keytar`만 외부 → `cli/bin/cli.mjs` 커밋
- **.gitignore 정리**: `.playwright-mcp/`, `verify-*.png` 추가
- 포트 3000·3001 기존 프로세스 종료 후 3000으로 재기동, API 401 정상 확인
- 4회 커밋·푸시 완료

### 실패한 시도
- root `package.json`에 `bin` 추가 후 `cli/src/index.mjs`(번들 없음) 참조 → `commander` 누락 오류
  → bun 번들(`cli/bin/cli.mjs`)로 해결

### 다음 액션
1. `USAGE_TRACKER_URL=http://localhost:3000 npx github:eugene-eee-hongkyu/ai-usage-tracker init` 실제 실행 — CLI 전체 플로우 검증
2. §10 시나리오 2: Claude Code 세션 종료 → SessionEnd hook 발화 → `/api/ingest` 데이터 수집 확인
3. B-2: Vercel + Supabase 배포

---

## Session 2026-04-25 18:17 — B-1 MVP 전체 빌드 완료 및 깃허브 푸시

### 작업 요약
- B-1 §5 빌드 순서 20단계 중 [13/20]부터 이어서 완료:
  - [13] 화면 #6 멤버 프로필 페이지 (`web/src/app/team/[userId]/page.tsx`) — ActivityCalendar 히트맵, 요약 통계, 프로젝트 목록
  - [14] 화면 #7 셋업 상태 페이지 (`web/src/app/setup-status/page.tsx`) — 단계 체크리스트, staleness 경고, 트러블슈팅 accordion
  - [15] CLI `cli/package.json`, `cli/src/index.ts` 엔트리포인트
  - [16] CLI `cli/src/init.ts` — 로컬 HTTP 서버 OAuth 콜백 → `/api/cli-auth`로 API 키 발급, keytar 저장, hook 머지, 백그라운드 backfill
  - [16] CLI `cli/src/submit.mjs` — SessionEnd hook 엔트리, ccusage spawn → POST `/api/ingest`
  - [17] CLI `cli/src/reset.ts`, `cli/src/sync.ts`
  - `/api/cli-auth/route.ts` 추가 — 인증된 사용자에게 API 키 발급 후 CLI 로컬 서버로 리디렉트
- TypeScript 타입 오류 4개 수정:
  - `tsconfig.json` target ES2017 추가 (Set iteration)
  - `auth.ts` profile.id 타입 캐스트
  - `ActivityCalendar` named import로 수정
  - Recharts Tooltip formatter 타입 완화
- `globals.css` 수정 — shadcn v4 import 제거, 순수 Tailwind로 교체
- `ingest/route.ts` sessionIdHash 직접 수용으로 수정 (submit.mjs와 정합)
- `.gitignore` 전면 정리 — node_modules, .next, CLI 빌드 결과물, drizzle/, coverage/ 추가
- dev 서버 기동 확인 (localhost:3002, 7개 페이지 200 OK, API 401 정상)
- 53개 파일 커밋·푸시 완료

### 실패한 시도
- `globals.css`에 shadcn v4 스타일 import(`@import "tw-animate-css"`, `border-border`) — 설치된 패키지 미지원으로 500 오류 → 순수 Tailwind로 교체
- `ActivityCalendar` default import → named import로 수정 필요
- Set spread(`...new Set()`) TypeScript 오류 → `Array.from(new Set())` 로 교체

### 다음 액션
- `cp .env.local web/.env.local` 완료 후 dev 서버 재시작 → `/api/ingest` 401 확인 (DB 연결 검증)
- §10 시나리오 1 검증: 실제 GitHub 로그인 → 대시보드 데이터 조회
- §10 시나리오 2: Claude Code SessionEnd hook 발화 → 데이터 수집 확인

---

## Session 2026-04-25 17:42 — B-1 빌드 사전 준비 완료 및 bypassPermissions 전환

### 작업 요약
- `/harness-init` 실행 — CLAUDE.md, .claude/settings.json, profiles 4개, CONTEXT.md, .harness/ 파일 4개, .gitignore 생성
- `/context-init` 실행 — docs/03_A-2, docs/05_B-1 문서 스캔 후 CONTEXT.md 초안 작성 (기술 스택, DB 스키마, 화면 7개, SO 결정 6개 반영)
- B-1 §1 체크리스트 완료:
  - Node.js v20.20.2 ✅ / Claude Code v2.1.90 ✅ / Docker v29.4.0 ✅
  - GitHub repo private 전환 ✅
  - GitHub OAuth App 등록 (CLIENT_ID/SECRET 확보) ✅
  - .env.local 생성 ✅
- `/switch-mode bypassPermissions` — B-1 빌드용 YOLO 모드 전환

### 다음 액션
- Docker Desktop 실행 확인 후 새 세션(`--dangerously-skip-permissions`)에서 B-1 §11 프롬프트로 빌드 시작
- B-1 §5 빌드 순서 20단계 실행
- §10 시나리오 1·2 검증 후 B-2 진입

---

## Session 2026-04-25 17:16 — GitHub 초기 푸시 및 하네스 초기화

### 작업 요약
- `docs/` 파일 2개를 `ai-usage-tracker` 저장소에 첫 커밋으로 푸시
- 원격 저장소 미존재 확인 → `gh repo create`로 생성 후 푸시 성공
- `/harness-init` 명령으로 템플릿 repo에서 파일 fetch 및 하네스 구조 초기화
  - 신규 생성: `CLAUDE.md`, `.claude/settings.json`, profiles 4개
  - 신규 생성: `CONTEXT.md`, `.harness/` 산하 파일 4개, `.gitignore`
- harness-doctor 점검 실행 (hooks / commands / 환경변수 / 텔레그램 / 런타임 / LaunchAgent)

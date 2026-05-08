# [LO] 로그인 — QA 테스트케이스

## 1. 문서 개요

| 항목 | 내용 |
| --- | --- |
| 대상 기능 | OAuth (GitHub / Google) 로그인 + 도메인 화이트리스트 + DB 에러 표시 |
| 기획 문서 (A-2) | [docs/03_A-2_프로세스를_화면으로_사용량대시보드_v6.md §2 #1](../03_A-2_프로세스를_화면으로_사용량대시보드_v6.md) |
| C-1 brief | [docs/C-1.qa-implementation-brief.md §1·§3·§4-5·§5-2](../C-1.qa-implementation-brief.md) |
| 대상 앱 | 공통 (모든 사용자) |
| 작성일 | 2026-05-08 |

## 2. 공통 사전조건

| 조건 | 상세 (C-1 페르소나 ID) |
| --- | --- |
| 테스트 환경 | 로컬 dev (`http://localhost:3000`) — 라이브 Supabase 격리 |
| 기본 계정 | P1 (신규, DB rows=0) — C-1 §2 |
| 필요 데이터 | `psql -c "TRUNCATE users, user_snapshots, period_snapshots, daily_visits CASCADE;"` (P1 시드, [C-1 §2 P1](../C-1.qa-implementation-brief.md)) |
| ENV | `ALLOWED_EMAIL_DOMAINS=iskra.world` ([C-1 §4-7](../C-1.qa-implementation-brief.md)), `ADMIN_EMAIL=eugene.eee@iskra.world` |

## 3. 접근 권한 테스트

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| LO-0-01 | 권한 | P1 (비로그인) — C-1 §2 | 1. session 쿠키 없는 context 로 `page.goto('/dashboard')` | URL 이 `/login?callbackUrl=%2Fdashboard` 패턴으로 변경 (`page.url()` regex `\/login\?callbackUrl=`) — middleware redirect (C-1 §1 `/api/dashboard` 401, [route.ts:105](../../web/src/app/api/dashboard/route.ts#L105)) | |
| LO-0-02 | 권한 | P1 (비로그인) — C-1 §2 | 1. session 쿠키 없는 context 로 `page.goto('/team')` | URL 이 `/login?callbackUrl=%2Fteam` 패턴으로 변경 — C-1 §1 `/api/team` 401 ([route.ts:109](../../web/src/app/api/team/route.ts#L109)) 동반 | |
| LO-0-03 | 권한 | P1 (비로그인) — C-1 §2 | 1. session 쿠키 없는 context 로 `page.goto('/setup-status')` | URL 이 `/login?callbackUrl=%2Fsetup-status` 패턴으로 변경 — C-1 §1 `/api/setup/status` 401 ([route.ts:10](../../web/src/app/api/setup/status/route.ts#L10)) | |
| LO-0-04 | 권한 | P1 (비로그인) — C-1 §2 | 1. session 쿠키 없는 context 로 `page.goto('/api/cli-auth')` | URL 이 `/login?callbackUrl=%2Fapi%2Fcli-auth` 패턴으로 변경 — [cli-auth/route.ts:14](../../web/src/app/api/cli-auth/route.ts#L14) `redirect('/login?callbackUrl=...')` | |
| LO-0-05 | 권한 | P1 (비로그인) — C-1 §2 | 1. session 쿠키 없는 context 로 `page.goto('/member')` | URL 이 `/login?callbackUrl=%2Fmember` 패턴으로 변경 — `/member` server-side admin guard ([member/page.tsx:18](../../web/src/app/member/page.tsx#L18)) | |

## 4. 화면별 테스트

### 4-1. `/login` 랜딩 — A-2 §2 #1 / C-1 페르소나 P1

#### 정상 동작

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| LO-1-01 | 정상 | P1 (비로그인) — C-1 §2 | 1. `page.goto('/login')` | `[data-testid="login-btn-github"]` 1 visible (`button` 또는 `a`) + 텍스트 정확히 `GitHub로 시작하기` (C-1 §4-5) | testid 추가 PR 동반 ([login/page.tsx:31](../../web/src/app/login/page.tsx#L31), C-1 §5-2) |
| LO-1-02 | 정상 | P1 (비로그인) — C-1 §2 | 1. `page.goto('/login')` | `[data-testid="login-btn-google"]` 1 visible + 텍스트 정확히 `Google로 시작하기` (C-1 §4-5) | testid 추가 PR 동반 ([login/page.tsx:41](../../web/src/app/login/page.tsx#L41)) |
| LO-1-03 | 정상 | P1 (비로그인) — C-1 §2 | 1. `page.goto('/login')` | `[data-testid="login-error-domain"]` count=0 + `[data-testid="login-error-other"]` count=0 (query string 없음 → 에러 박스 미렌더, [login/page.tsx:19,24](../../web/src/app/login/page.tsx#L19)) | |

#### 데이터 검증

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| LO-1-04 | 데이터 | P1 (비로그인) — C-1 §2 | 1. `page.goto('/login?error=domain')` | `[data-testid="login-error-domain"]` 1 visible + 텍스트 정확히 `허용되지 않은 이메일 도메인입니다.` (C-1 §4-5, [login/page.tsx:21](../../web/src/app/login/page.tsx#L21)) — 빨간 박스 (CSS class `text-red-*` 또는 `bg-red-*`) | |
| LO-1-05 | 데이터 | P1 (비로그인) — C-1 §2 | 1. `page.goto('/login?error=db')` | `[data-testid="login-error-other"]` 1 visible + 텍스트 정확히 `로그인 중 오류가 발생했습니다.` (C-1 §4-5, [login/page.tsx:26](../../web/src/app/login/page.tsx#L26)) | C-1 §1 `/api/auth/[...nextauth]` `/login?error=db` 분기 ([auth.ts:56](../../web/src/lib/auth.ts#L56)) |
| LO-1-06 | 데이터 | P1 (비로그인) — C-1 §2 | 1. `page.goto('/login?error=other')` (또는 `?error=`임의값) | `[data-testid="login-error-other"]` 1 visible + 동일 텍스트 (`error` 파라미터가 `domain` 외 모든 값 → other 분기, [login/page.tsx:24](../../web/src/app/login/page.tsx#L24)) | |

#### 엣지케이스

| TC-ID | 분류 | 사전조건 (C-1 페르소나) | 테스트 절차 | 기대 결과 (C-1 selector) | 비고 |
| --- | --- | --- | --- | --- | --- |
| LO-1-07 [M] | 엣지 | P1 (비로그인) — C-1 §2 | 1. `[data-testid="login-btn-github"]` 클릭 → 진짜 GitHub OAuth 화면으로 이동 | (실제 OAuth 페이지 captcha/2FA — 검증 불가) | C-1 §3 #1 첫 행 "수동" 명시 — Playwright 차단. CI 에서는 LO-1-09 (Credentials mock) 으로 대체 |
| LO-1-08 [M] | 엣지 | P1 (비로그인) — C-1 §2 | 1. `[data-testid="login-btn-google"]` 클릭 → 진짜 Google OAuth 화면 | (실제 OAuth 페이지 — 검증 불가) | C-1 §3 #1 동일 — 수동 |
| LO-1-09 | 엣지 | P1 (비로그인) — C-1 §2 + Credentials provider mock 등록 | 1. `signIn('credentials',{email:'alice@iskra.world'})` 호출 (도메인 화이트리스트 통과) → `getServerSession` 검증 | NextAuth `__Secure-next-auth.session-token` 쿠키 1개 존재 + `/api/dashboard` 응답 200 (C-1 §3 #1 우회 전략, [auth.ts:32~37](../../web/src/lib/auth.ts#L32) 도메인 검증 통과) | C-1 §3 우회 전략 — 도메인 검증만 통과 검증 |
| LO-1-10 | 엣지 | P1 (비로그인) — C-1 §2 + Credentials provider mock | 1. `signIn('credentials',{email:'evil@gmail.com'})` 호출 (도메인 화이트리스트 미일치) | URL 이 `/login?error=domain` 으로 리다이렉트 (C-1 §1 `/api/auth/[...nextauth]` 응답, [auth.ts:35](../../web/src/lib/auth.ts#L35)) + LO-1-04 와 동일한 에러 박스 노출 | C-1 §3 #1 둘째 행 "부분" |
| LO-1-11 | 엣지 | P1 (비로그인) — C-1 §2 + DB connection 차단 (postgres stop) | 1. `signIn('credentials',{email:'alice@iskra.world'})` 호출 | URL 이 `/login?error=db` 으로 리다이렉트 ([auth.ts:56](../../web/src/lib/auth.ts#L56) DB insert catch) + LO-1-05 와 동일한 에러 박스 노출 | C-1 §3 #1 셋째 행 "부분" — `pg_ctl stop` 또는 docker stop postgres |
| LO-1-12 | 엣지 | P2 (이미 로그인) — C-1 §2 | 1. session 쿠키 있는 context 로 `page.goto('/login')` | `[data-testid="login-btn-github"]` 1 visible (NextAuth 자동 redirect 없음 — `/login` 은 항상 접근 가능, [login/page.tsx](../../web/src/app/login/page.tsx) 클라이언트 분기 없음) | "이미 로그인 중에도 /login 자체는 노출" 검증 — A-2 §2 #1 흐름 |

---

## §A. 자가 검증 (출력 직전 정량 체크)

- 모호 어휘 0건 — `grep -E "적절히|자연스럽게|충분히|좋게|원활히|매끄럽게" QA_LO_login.md` → 0
- 단독 모호 동사 0건 — 모든 `변경/이동/표시/노출` 가 `URL 이 X 으로 변경` / `[testid] 1 visible` 등 수식어 결합
- 빈 기대 결과 셀 0건 — LO-1-07/08 [M] 도 "(실제 OAuth 페이지 — 검증 불가)" 명시
- C-1 cross-ref — 모든 TC 행에 `C-1 §`, `P{n}` 또는 `[file:line]` 인용 1개 이상
- 추상 사전조건 0건 — 모든 사전조건이 P{n} 페르소나 ID 인용

# CONTEXT.md — 프로젝트 맥락

> Claude Code 세션 시작 시 자동으로 로드된다. OSS public 버전 — 내부 운영 컨텍스트는 sibling `ai-usage-tracker-ops` repo 참조.

## 프로젝트 개요

**Claude Code 사용량 자동 수집 + 개인 대시보드 + 팀 랭킹** 웹앱.  
세션 종료마다 ccusage로 데이터를 수집하고, 개인 효율 지표와 팀 랭킹을 시각화한다.

라이브: [aiusage.z21labs.world](https://aiusage.z21labs.world) (앱) · [ai.z21labs.world](https://ai.z21labs.world) (랜딩)

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 14 App Router (web + API 단일 코드베이스) |
| DB | Postgres — 로컬: Docker `postgres:16` / 배포: Supabase |
| ORM | Drizzle |
| 인증 | Auth.js (NextAuth) — 빌드 시점 `npm view` stable 자동 선택 |
| UI | shadcn/ui + Tailwind |
| 차트 | Recharts + react-activity-calendar (heatmap) |
| CLI 패키지 | Bun + commander |
| 데이터 수집 | ccusage CLI → child_process spawn + Claude Code **SessionEnd hook** |
| 비밀 저장 | keytar (Mac Keychain / Win Credential Manager / Linux libsecret 자동 분기) |
| 배포 | Vercel + Supabase |
| 데스크톱 | Electron 인스톨러 (mac arm64 .dmg) + better-sqlite3 |

**LLM 호출 없음** — Today's MVP 멘트·최적화 제안 모두 deterministic 룰 기반.

## 핵심 구조

```
ai-usage-tracker/
├── web/                          ← Next.js 대시보드
│   ├── src/app/
│   │   ├── login/                ← 랜딩 / GitHub + Google OAuth 진입
│   │   ├── setup/                ← CLI 설치 마법사 (가입 직후)
│   │   ├── setup-status/         ← 셋업 상태 + 내 디바이스 (api_tokens) 관리
│   │   ├── onboard-team/         ← 팀 이름 첫 설정 (namePending=true 일 때)
│   │   ├── wizard/               ← LOCAL_MODE 마이그레이션 위저드
│   │   ├── dashboard/            ← 개인 메인 (옛 detail 탭 통합, M6c 재구조)
│   │   ├── team/                 ← 우리 팀 한눈에
│   │   │   ├── [userId]/         ← 멤버 프로필
│   │   │   └── [userId]/dashboard/ ← 어드민이 멤버 시점으로 dashboard view
│   │   ├── ranking/              ← 전체 personal 사용자 랭킹 (5 metric, 마스킹)
│   │   ├── changelog/            ← 릴리즈 노트
│   │   ├── suggest/              ← 사용자 제안 → Resend
│   │   ├── member/               ← (legacy) 멤버 진입점
│   │   ├── me/devices/           ← legacy URL → /setup-status redirect
│   │   ├── admin/
│   │   │   ├── users/            ← 우리 팀 멤버 list + suspend/delete
│   │   │   ├── members/          ← 초대 + 가입 신청 관리
│   │   │   ├── team/             ← 팀 정보 + rename + auto-join
│   │   │   ├── team/ranking/     ← 팀끼리 비교 랭킹 (Billing-Admin)
│   │   │   └── settings/         ← 권한·옵션
│   │   ├── platform-admin/       ← ADMIN_EMAIL 화이트리스트 전용
│   │   │   ├── all-users/        ← 모든 팀 사용자 카드 그리드
│   │   │   ├── all-teams/        ← 모든 팀 비교 (활용지수 desc)
│   │   │   ├── all-personal/     ← Personal 사용자 어드민 뷰
│   │   │   ├── audit/            ← 감사 로그 (hash chain integrity)
│   │   │   └── settings/         ← Platform 옵션
│   │   ├── downloads/            ← /downloads/mac 등 GitHub Releases redirect
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── auth/verify/      ← CLI repair self-heal (rate-limited)
│   │       ├── cli-auth/         ← CLI OAuth callback (Sec-Fetch-Site CSRF 차단)
│   │       ├── ingest/           ← POST (CLI 세션 종료 hook)
│   │       ├── ingest/historical/← 신규 사용자 backfill
│   │       ├── dashboard/        ← 개인 데이터
│   │       ├── team/             ← 팀 데이터
│   │       ├── ranking/          ← personal 랭킹
│   │       ├── members/[userId]/ ← 멤버 프로필 데이터
│   │       ├── me/devices/       ← 본인 api_tokens CRUD
│   │       ├── personal/toggle/  ← 랭킹 참여 on/off
│   │       ├── visit/  ·  visit-end/   ← dwell tracking
│   │       ├── admin/{users,teams,invitations,audit,inactive-users,...}/
│   │       ├── admin/team/{auto-join,rename,ranking}/
│   │       ├── admin/platform/{switch-team,exit-view}/
│   │       ├── platform-admin/{all-users,all-personal}/
│   │       ├── cron/anonymize-expired-users/  ← Vercel cron, Bearer CRON_SECRET
│   │       ├── config/{status,save}/  ← LOCAL_MODE 만
│   │       ├── about/  ·  changelog/latest/  ·  mode/  ·  setup/status/
│   │       ├── user/{timezone,plan-tier}/
│   │       └── suggest/          ← 사용자 제안 (Resend)
│   └── src/lib/
│       ├── auth.ts               ← NextAuth signIn callback (provider lock-in, auto-join, personal fallback)
│       ├── auth-guards.ts        ← requireUser/Membership/Billing/Platform Admin
│       ├── effective-team.ts     ← view-as cookie 격리
│       ├── admin.ts              ← ADMIN_EMAIL env 화이트리스트 (fallback 없음 — H2)
│       ├── audit.ts              ← audit_logs hash chain write
│       ├── email.ts              ← Resend wrapper (invitation/suggestion/approve)
│       ├── ccusage-row.ts        ← ccusage 19.x period 키 정규화
│       ├── sync/run-ingest.ts    ← ingest 핵심 로직 (promote/retention/upsert)
│       ├── plan-health.ts        ← tier 추정 + analyzePlanHealth
│       ├── rules/                ← efficiency / power-index (deterministic)
│       └── db/                   ← schema.ts (PG) + schema-sqlite.ts (LOCAL_MODE)
├── cli/                          ← CLI 패키지
│   └── src/
│       ├── index.mjs             ← bin entry (100755)
│       ├── init.ts               ← OAuth + keytar + hook 등록
│       ├── sync.mjs              ← 수동 sync 명령
│       ├── submit.mjs            ← SessionEnd hook 엔트리
│       ├── historical.mjs        ← backfill
│       └── doctor.ts
├── installer/electron/           ← Electron 데스크톱 인스톨러
├── vscode-extension/             ← VS Code 익스텐션
├── compose.yml                   ← postgres:16 로컬용
└── package.json                  ← workspace (web + cli)
```

**DB 스키마 (Drizzle, PG 17 / Supabase)** — 주요 테이블만:
- `users` — id, github_id, email (unique), name, avatar_url, api_key_hash (legacy), timezone, plan_tier, **provider** (H1: 'github'|'google'|null), role, permissions (jsonb), suspended_at, deleted_at, personal, ranking_hidden, last_synced_at
- `teams` — id, name, slug (unique), owner_id, name_pending, auto_join_domains (jsonb), auto_join_enabled, max_members, type ('normal'|'personal'), deleted_at
- `team_members` — id, team_id, user_id, role ('owner'|'admin'|'member'), joined_at, deleted_at — unique (team, user)
- `api_tokens` — id, team_id, user_id, name (device), hash (sha256), scopes, metadata (envInfo), last_used_at, revoked_at
- `invitations` — id, team_id, email, invited_by, token, role, permissions, expires_at, accepted_at, cancelled_at
- `join_requests` — (legacy, dead 추적 중)
- `user_snapshots` — user_id, team_id, **token_id** (M6f device-scope, nullable for legacy), raw_json, totals, current_{day,week,month}_*
- `period_snapshots` — daily/weekly/monthly promote 결과
- `user_blocks` — ccusage 5h block 단위
- `daily_visits` — dwell tracking
- `audit_logs` — hash chain (prev_hash / row_hash), actor_user_id, action, target, metadata, ip, actor_is_platform_owner
- `suggestions` — 사용자 제안 + email_error

**환경변수** (값은 `.env` 에 — `.env.example` 참조):
```
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback
ALLOWED_EMAIL_DOMAINS=<comma-separated whitelist>    ← 비우면 모든 도메인 허용
ADMIN_EMAIL=<쉼표 구분>                              ← 필수 (H2: fallback 없음)
DATABASE_URL=postgresql://localhost:5432/<db_name>
NEXTAUTH_SECRET                                       ← openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY                                        ← invitation/suggestion 이메일
CRON_SECRET                                           ← Vercel cron Bearer
```

**보안 가드 (2026-05-28 감사 후)**:
- OAuth provider lock-in (`users.provider`) — 같은 email 다른 provider 매칭 reject
- e2e Credentials provider 는 `NODE_ENV=test` 단독 (prod 우회 표면 0)
- `/api/cli-auth` Sec-Fetch-Site cross-site 차단
- `/api/auth/verify` 단일 실패 응답 + IP rate limit (in-memory 30/min)
- cron Bearer timingSafeEqual
- auto-join cap race 는 `pg_advisory_xact_lock(team_id)` 직렬화 (invitations + signIn)

## 개발 서버

| 환경 | URL |
|---|---|
| 로컬 | `http://localhost:3000` |
| 라이브 (앱) | `https://aiusage.z21labs.world` |
| 라이브 (랜딩) | `https://ai.z21labs.world` |

## 빌드 / 테스트

```bash
npm install
npm run -w web build      # web workspace 빌드 (next build)
npm run -w web dev        # 개발 서버
npx -w web tsc --noEmit   # typecheck
```

E2E: `docs/e2e-v2/` (framework v3.2 카피본)

## 내부 운영 컨텍스트

이 repo 외부에 sibling private repo `ai-usage-tracker-ops` 가 있다. 다음이 거기에 있다:
- `harness/` — state.md / decision.md / worklog.md / backlog.md (이 repo `.harness/` symlink 의 실체)
- `docs/` — D-1 마케팅 브리프, D-2a/b 인터뷰, runs/ 실행 로그, qa-output/
- `CLAUDE-internal.md` / `CONTEXT-internal.md` — sanitize 전 원본

ops repo 클론 + symlink 셋업은 ops README 참조.

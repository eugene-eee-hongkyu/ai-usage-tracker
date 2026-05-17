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
├── web/                    ← Next.js 대시보드
│   ├── src/app/
│   │   ├── (auth)/login/   ← 화면 #1 랜딩/OAuth
│   │   ├── setup/          ← 화면 #2 셋업 가이드
│   │   ├── dashboard/      ← 화면 #3 개인 메인
│   │   │   └── detail/     ← 화면 #4 개인 디테일
│   │   ├── team/           ← 화면 #5 팀 랭킹
│   │   │   └── [userId]/   ← 화면 #6 멤버 프로필
│   │   ├── setup-status/   ← 화면 #7 셋업 상태
│   │   ├── downloads/      ← /downloads/mac 등 GitHub Releases redirect
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── ingest/     ← POST (CLI가 세션 종료 시 호출)
│   │       ├── dashboard/  ← GET 개인 데이터
│   │       ├── team/       ← GET 팀 랭킹
│   │       └── feedback/   ← POST 👍/👎 + Done 클릭
│   └── src/lib/
│       ├── collectors/     ← ccusage spawn 어댑터
│       ├── rules/          ← 최적화 룰 (deterministic)
│       └── auth.ts         ← 도메인 화이트리스트 콜백
├── cli/                    ← CLI 패키지
│   └── src/
│       ├── init.ts         ← OAuth + keytar + hook 등록
│       ├── submit.mjs      ← SessionEnd hook 엔트리 (ccusage spawn → POST)
│       └── doctor.ts
├── installer/electron/     ← Electron 데스크톱 인스톨러
├── vscode-extension/       ← VS Code 익스텐션
├── docker-compose.yml      ← postgres:16 로컬용
└── package.json            ← workspace (web + cli)
```

**DB 스키마 (Drizzle)**:
- `users` — github_id, email, name, avatar_url, last_synced_at
- `sessions` — user_id, project, model, input/output tokens, cache_read/write, cost_usd, one_shot_edits, total_edits, started_at, ended_at
- `daily_agg` — matview (user_id, date, total_tokens, cost, sessions_count …)
- `period_snapshots` — daily/weekly/monthly aggregations
- `user_blocks` — active block tracking
- `daily_visits` — dwell time
- `suggestion_feedback` — user_id, suggestion_type, action

**환경변수** (값은 `.env` 에 — `.env.example` 참조):
```
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback
ALLOWED_EMAIL_DOMAINS=<comma-separated whitelist>
DATABASE_URL=postgresql://localhost:5432/<db_name>
NEXTAUTH_SECRET                    ← openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

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

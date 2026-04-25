# CONTEXT.md — 프로젝트 맥락

> Claude Code 세션 시작 시 자동으로 로드된다. 핵심 정보만 유지하고 나머지는 `.harness/`에 기록한다.

## 프로젝트 개요

Primus Labs 사내 개발자 10명 대상 **Claude Code 사용량 자동 수집 + 개인 대시보드 + 팀 랭킹** 웹앱.  
세션 종료마다 ccusage로 데이터를 수집하고, 개인 효율 지표와 팀 랭킹을 시각화한다.  
**lower bar**: 본인이 한 달에 한 번 보면 성공.

**현재 단계**: B-1 — 로컬 빌드 (코드 없음, 빌드 시작 전)  
문서 위치: `docs/03_A-2_…직행.md` (화면 설계), `docs/05_B-1_…압축.md` (빌드 지침)

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 14 App Router (web + API 단일 코드베이스) |
| DB | Postgres — 로컬: Docker `postgres:16` / 배포(B-2): Supabase |
| ORM | Drizzle |
| 인증 | Auth.js (NextAuth) — 빌드 시점 `npm view` stable 자동 선택 (v4 or v5) |
| UI | shadcn/ui + Tailwind slate 톤 (A-3 디자인 스킵) |
| 차트 | Recharts + react-activity-calendar (heatmap) |
| CLI 패키지 | Bun + commander — `npx github:primus-labs/usage-tracker init` |
| 데이터 수집 | ccusage CLI → child_process spawn + Claude Code **SessionEnd hook** |
| 비밀 저장 | keytar (Mac Keychain / Win Credential Manager / Linux libsecret 자동 분기) |
| 배포 (B-2) | Vercel + Supabase |

**LLM 호출 없음** — Today's MVP 멘트·5개 최적화 제안 모두 deterministic 룰 기반.

## 핵심 구조

```
usage-tracker/
├── web/                    ← Next.js 대시보드
│   ├── app/
│   │   ├── (auth)/login/   ← 화면 #1 랜딩/OAuth
│   │   ├── setup/          ← 화면 #2 셋업 가이드 (polling)
│   │   ├── dashboard/      ← 화면 #3 개인 메인 ★
│   │   │   └── detail/     ← 화면 #4 개인 디테일
│   │   ├── team/           ← 화면 #5 팀 랭킹 ★
│   │   │   └── [userId]/   ← 화면 #6 멤버 프로필
│   │   └── setup-status/   ← 화면 #7 셋업 상태
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── ingest/     ← POST (CLI가 세션 종료 시 호출)
│   │       ├── dashboard/  ← GET 개인 데이터
│   │       ├── team/       ← GET 팀 랭킹
│   │       └── feedback/   ← POST 👍/👎 + Done 클릭
│   └── lib/
│       ├── collectors/     ← ccusage spawn 어댑터
│       ├── rules/          ← 5개 optimization 룰 (deterministic)
│       └── auth.ts         ← 도메인 화이트리스트 콜백
├── cli/                    ← @primus/usage-tracker
│   └── src/
│       ├── init.ts         ← OAuth + keytar + hook 등록 + backfill 백그라운드
│       ├── submit.mjs      ← SessionEnd hook 엔트리 (ccusage spawn → POST)
│       ├── reset.ts
│       └── sync.ts
├── docker-compose.yml      ← postgres:16 로컬용
└── package.json            ← workspace (web + cli)
```

**DB 스키마 (Drizzle)**:
- `users` — github_id, email, name, avatar_url, last_synced_at
- `sessions` — user_id, project, model, input/output tokens, cache_read/write, cost_usd, one_shot_edits, total_edits, started_at, ended_at
- `daily_agg` — matview (user_id, date, total_tokens, cost, sessions_count …)
- `suggestion_feedback` — user_id, suggestion_type, action (`done|dismiss|thumbs_up|thumbs_down`)

**환경변수**:
```
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback
ALLOWED_EMAIL_DOMAIN=primuslabs.gg
DATABASE_URL=postgresql://localhost:5432/primus_usage
NEXTAUTH_SECRET  ← openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

## 중요 결정사항

| ID | 결정 | 내용 |
|---|---|---|
| SO1 | Backfill | 전체 backfill, 단 init 종료 조건에서 분리 → 백그라운드 자식 프로세스 |
| SO2 | 공개 범위 | 전원 공개. 단 본인 #4의 5개 제안·효율 지표는 본인만 |
| SO3 | 랭킹 메트릭 | 최다 사용 + 최고 효율 병렬 카드 + Today's MVP (합성 점수: 토큰 × one-shot rate) |
| SO4 | 최적화 제안 | 5개 룰 + 신뢰도 라벨 "낮음"만 노출 + Done 버튼 + 👍/👎 피드백 |
| SO5 | One-shot 정의 | edit/write 도구 호출이 첫 시도 success로 끝난 비율 |
| SO6 | 누락 방지 | SessionEnd hook 단독, ccusage가 jsonl 전체 파싱 (중복 제거 포함) |
| - | Auth.js 버전 | 빌드 시점 `npm view next-auth dist-tags` 로 stable 자동 선택 |
| - | ccusage 의존 | 버전 pin 없음. 깨지면 #3 대시보드 배너로 즉시 발견 |

**Hold 플래그**: Windows에서 SessionEnd hook 발화 검증 → B-1 §10 시나리오 2에서 친구 1명 수동 검증 필요.

**빌드 순서**: `docs/05_B-1_…압축.md §5` 20단계 참조.  
**멈춤 트리거**: 같은 문서 §9 참조 (DB 스키마 변경 시도, 화면 요소 추가/삭제 등).

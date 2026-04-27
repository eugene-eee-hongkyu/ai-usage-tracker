# AI Usage Tracker

Claude Code 사용량을 자동으로 수집하고 개인 대시보드 + 팀 통계로 시각화하는 웹앱입니다.

세션이 종료될 때마다 ccusage로 데이터를 수집하고, 토큰·비용·캐시 히트율 등 효율 지표와 팀 현황을 보여줍니다.

LLM 호출 없음 — 모든 지표와 등급은 deterministic 룰 기반입니다.

---

## 화면 구성

### 개인 대시보드 (`/dashboard`)

| 카드 | 내용 |
|---|---|
| Daily Activity | 일별 비용 막대 + 세션 수 |
| Efficiency | 6개 지표(cache hit · 1-shot · $/session · calls/session · $/call · out/in) + 종합 등급 |
| By Project | 프로젝트별 비용·평균 비용/세션 |
| By Activity | 활동별 비용·턴·1-shot % |
| Top Sessions | 비용 상위 5개 세션 |
| By Model | 모델별 비용·cache hit·호출 수 |
| Core Tools | 도구 사용 빈도 |
| Shell Commands | 쉘 명령어 사용 빈도 |
| MCP Servers | MCP 서버 사용 빈도 |

기간 필터: 오늘 / 이번 주 / 이번 달 / 전체

### 팀 대시보드 (`/team`)

| 카드 | 내용 |
|---|---|
| By Member | 멤버별 비용 stacked area 차트 |
| Team Total | 팀 합산 비용 추세 차트 |
| Efficiency | 멤버별 효율 지표 히트맵 테이블 (cache · 1-shot · $/session · out/in · 종합 배지) |
| Top Sessions | 팀 전체 비용 상위 15개 세션 |
| Usage | 멤버별 비용 막대 |
| Team Activities | 활동별 팀 합산 턴·비용 막대 |

팀 요약 바: 총비용 · 총 세션 수 · 활성 멤버 수 · 평균 cache hit · 평균 1-shot

### 기타

| 화면 | 설명 |
|---|---|
| `/login` | GitHub OAuth 로그인 |
| `/setup` | CLI 설치 안내 + 진행 상태 폴링 |
| `/setup-status` | 설정 완료 여부 확인 |

---

## 빠른 시작

### 1. 서버 배포 (Vercel + Supabase)

1. **Supabase** 프로젝트 생성 후 SQL Editor에서 스키마 실행:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  github_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  api_key_hash TEXT,
  timezone TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  raw_json JSONB NOT NULL,
  total_cost NUMERIC(10,4) DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  calls_count INTEGER DEFAULT 0,
  cache_hit_pct REAL DEFAULT 0,
  overall_one_shot REAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

> `user_snapshots`는 사용자당 1행 upsert 방식입니다. `raw_json`에 멀티 피리어드 포맷(`{ today, week, month, all }`)으로 전체 데이터를 저장하고, 대시보드 API에서 필터링합니다.

2. **GitHub OAuth App** 등록 (`https://github.com/settings/developers`):
   - Homepage URL: `https://your-vercel-app.vercel.app`
   - Callback URL: `https://your-vercel-app.vercel.app/api/auth/callback/github`

3. **(선택) Google OAuth** 설정 — Google Cloud Console에서 OAuth 클라이언트 생성:
   - Redirect URI: `https://your-vercel-app.vercel.app/api/auth/callback/google`

4. **Vercel** 배포 후 환경변수 설정:

```
DATABASE_URL=postgresql://...          # Supabase Transaction Pooler URL
NEXTAUTH_SECRET=...                    # openssl rand -base64 32
NEXTAUTH_URL=https://your-vercel-app.vercel.app
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...                   # 선택
GOOGLE_CLIENT_SECRET=...               # 선택
ALLOWED_EMAIL_DOMAINS=yourcompany.com  # 빈값이면 모든 도메인 허용
```

> **Supabase 주의사항**: Vercel은 IPv4만 지원하므로 Direct URL 대신 Transaction Pooler URL을 사용해야 합니다. Supabase → Settings → Database → Connection Pooling에서 IPv4 Shared Pooler를 활성화하세요. 비밀번호에 특수문자가 포함된 경우 URL 인코딩이 필요합니다 (`!` → `%21`, `@` → `%40`).

---

### 2. CLI 설치 (팀원 각자 실행)

```bash
npx github:eugene-eee-hongkyu/ai-usage-tracker init
```

실행하면:
- 브라우저가 열리고 GitHub/Google 로그인으로 API 키 발급
- Claude Code `~/.claude/settings.json`에 SessionEnd hook 자동 등록
- 최근 90일치 데이터 백그라운드 백필

이후 Claude Code 세션이 종료될 때마다 자동으로 데이터가 수집됩니다.

#### 기타 CLI 명령어

```bash
# 과거 데이터 재동기화 (기본 90일)
npx github:eugene-eee-hongkyu/ai-usage-tracker sync
npx github:eugene-eee-hongkyu/ai-usage-tracker sync --days 30

# API 키 재발급
npx github:eugene-eee-hongkyu/ai-usage-tracker reset
```

#### 서버 URL 변경 (직접 배포한 경우)

```bash
USAGE_TRACKER_URL=https://your-vercel-app.vercel.app npx github:eugene-eee-hongkyu/ai-usage-tracker init
```

---

## 로컬 개발

### 사전 준비

- Node.js 18+
- Docker (로컬 DB용)
- [ccusage](https://github.com/ryoppippi/ccusage) (`npm install -g ccusage`)

### 실행

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 DB 실행
docker compose up -d

# 3. 환경변수 설정
cp web/.env.example web/.env.local
# web/.env.local 수정

# 4. DB 스키마 적용
cd web && npx drizzle-kit push

# 5. 개발 서버 실행
npm run dev --workspace=web
```

### 환경변수 (로컬)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/primus_usage
NEXTAUTH_SECRET=local-secret
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## 데이터 수집 방식

Claude Code의 `SessionEnd` hook이 발화될 때마다 `ccusage export --json`을 실행하여 멀티 피리어드 집계 데이터를 `/api/ingest`로 전송합니다.

- 인증: `x-api-key` 헤더 (SHA-256 해시 검증)
- 저장: `user_snapshots` 테이블에 사용자당 1행 upsert
- `raw_json` 필드에 원본 JSON 전체를 보존해 기간 필터링 및 신규 지표 추가가 용이합니다

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 14 App Router |
| DB | PostgreSQL (로컬: Docker / 배포: Supabase) |
| ORM | Drizzle |
| 인증 | NextAuth v4 (GitHub, Google OAuth) |
| UI | Tailwind CSS + shadcn/ui |
| 차트 | Recharts |
| CLI | Node.js ESM + commander |
| 데이터 수집 | ccusage + Claude Code SessionEnd hook |
| 비밀 저장 | keytar (Mac Keychain / Win Credential Manager / Linux libsecret) |

---

## 라이선스

MIT

# AI Usage Tracker

Claude Code 사용량을 자동으로 수집하고 개인 대시보드 + 팀 랭킹으로 시각화하는 웹앱입니다.

세션이 종료될 때마다 ccusage로 데이터를 수집하고, 토큰/비용/캐시 히트율 등 효율 지표와 팀 랭킹을 보여줍니다.

---

## 화면 구성

| 화면 | 설명 |
|---|---|
| 대시보드 | 개인 토큰/비용/캐시히트율, 일별 차트, 모델별 내역 |
| 팀 랭킹 | 사용량·효율 Top 3, Today's MVP, 프로젝트별 통계 |
| 멤버 프로필 | 멤버별 히트맵, 요약 통계 |
| 셋업 | CLI 설치 안내 + 진행 상태 폴링 |

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
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id_hash TEXT UNIQUE NOT NULL,
  project TEXT NOT NULL DEFAULT 'claude-code',
  model TEXT NOT NULL,
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  cache_read BIGINT DEFAULT 0,
  cache_write BIGINT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  one_shot_edits INTEGER DEFAULT 0,
  total_edits INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_agg (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_tokens BIGINT DEFAULT 0,
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  cache_read BIGINT DEFAULT 0,
  cache_write BIGINT DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  active_hours INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE TABLE suggestion_feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. **GitHub OAuth App** 등록 (`https://github.com/settings/developers`):
   - Homepage URL: `https://your-vercel-app.vercel.app`
   - Callback URL: `https://your-vercel-app.vercel.app/api/auth/callback/github`

3. **(선택) Google OAuth** 설정 — Google Cloud Console에서 OAuth 클라이언트 생성:
   - Redirect URI: `https://your-vercel-app.vercel.app/api/auth/callback/google`

4. **Vercel** 배포 후 환경변수 설정:

```
DATABASE_URL=postgresql://...   # Supabase Transaction Pooler URL (IPv4 Shared Pooler 활성화)
NEXTAUTH_SECRET=...             # openssl rand -base64 32
NEXTAUTH_URL=https://your-vercel-app.vercel.app
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...            # 선택
GOOGLE_CLIENT_SECRET=...        # 선택
ALLOWED_EMAIL_DOMAINS=yourcompany.com,yourcompany.io   # 빈값이면 모든 도메인 허용
```

> **Supabase 주의사항**: Vercel은 IPv4만 지원하므로 Direct URL 대신 Transaction Pooler URL을 사용해야 합니다. Supabase → Settings → Database → Connection Pooling에서 "Use IPv4 connection" 토글을 활성화하세요. 비밀번호에 특수문자(`!`, `@` 등)가 포함된 경우 URL 인코딩이 필요합니다 (`!` → `%21`, `@` → `%40`).

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
# 과거 데이터 재동기화
npx github:eugene-eee-hongkyu/ai-usage-tracker sync

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

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 14 App Router |
| DB | PostgreSQL (로컬: Docker / 배포: Supabase) |
| ORM | Drizzle |
| 인증 | NextAuth v4 (GitHub, Google) |
| UI | Tailwind CSS + shadcn/ui |
| 차트 | Recharts + react-activity-calendar |
| CLI | Node.js ESM + commander |
| 데이터 수집 | ccusage + Claude Code SessionEnd hook |
| 비밀 저장 | keytar (Mac Keychain / Win Credential Manager / Linux libsecret) |

---

## 데이터 수집 방식

Claude Code의 `SessionEnd` hook이 발화될 때마다 `ccusage daily --json`을 실행하여 일별·모델별 집계 데이터를 `/api/ingest`로 전송합니다. 중복 제거는 `session_id_hash`(날짜+모델 기반 SHA-256)로 처리합니다.

LLM 호출 없음 — 모든 지표와 최적화 제안은 deterministic 룰 기반입니다.

---

## 라이선스

MIT

-- codeburn migration
-- 기존 3개 테이블 제거 + user_snapshots 생성

DROP TABLE IF EXISTS suggestion_feedback;
DROP TABLE IF EXISTS daily_agg;
DROP TABLE IF EXISTS sessions;

CREATE TABLE IF NOT EXISTS user_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  raw_json JSONB NOT NULL,
  total_cost REAL NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  calls_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_pct REAL NOT NULL DEFAULT 0,
  overall_one_shot REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_snapshots_user_uniq ON user_snapshots (user_id);

-- 2026-05-16 Plan Health 기능 — users 테이블에 plan_tier 컬럼 추가
-- 값: 'pro' | 'max5' | 'max20' | 'team' | 'api' | null (= 자동 추정만 사용)
-- 사용자가 본인 plan 을 명시할 때 사용. 권장 (다운/업그레이드) 계산 근거.
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_tier TEXT;

-- User blocks: ccusage blocks --json 결과를 5h 빌링 블록 단위로 누적.
-- gap 블록(isGap=true) 은 저장하지 않고 활성 블록만 upsert.
-- minutes = floor((actual_end_time - start_time) / 60).
-- 동일 block_id 재수집 시 ended_at/minutes/totals 가 갱신되도록 unique index 사용.

CREATE TABLE IF NOT EXISTS user_blocks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  block_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  minutes INTEGER NOT NULL,
  entries INTEGER NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  models JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_user_block_uniq
  ON user_blocks (user_id, block_id);

CREATE INDEX IF NOT EXISTS user_blocks_user_started_idx
  ON user_blocks (user_id, started_at DESC);

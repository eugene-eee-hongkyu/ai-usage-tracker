-- Period snapshots: weekly/monthly archive
-- Run on Supabase SQL editor

ALTER TABLE user_snapshots
  ADD COLUMN IF NOT EXISTS current_week_raw_json JSONB,
  ADD COLUMN IF NOT EXISTS current_week_start DATE,
  ADD COLUMN IF NOT EXISTS current_month_raw_json JSONB,
  ADD COLUMN IF NOT EXISTS current_month_start DATE;

CREATE TABLE IF NOT EXISTS period_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
  raw_json JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS period_snapshots_uniq
  ON period_snapshots (user_id, period_type, period_start);

CREATE INDEX IF NOT EXISTS period_snapshots_user_type_start_idx
  ON period_snapshots (user_id, period_type, period_start DESC);

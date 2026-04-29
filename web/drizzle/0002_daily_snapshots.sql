-- Daily snapshots: add current_day_* columns to user_snapshots
-- Run on Supabase SQL editor. period_snapshots table reused (period_type='daily').

ALTER TABLE user_snapshots
  ADD COLUMN IF NOT EXISTS current_day_raw_json JSONB,
  ADD COLUMN IF NOT EXISTS current_day_start DATE;

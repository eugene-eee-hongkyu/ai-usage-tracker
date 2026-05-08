-- P7 — snapshot 있음 / overview 없음 (sync needed). C-1 §2 P7.
-- /dashboard 진입 시 "sync needed" 박스 + 복사 버튼 노출.

TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at)
VALUES (
  11,
  'gh-p7-bob',
  'bob@iskra.world',
  'Bob',
  'Asia/Singapore',
  'sha256:0000000000000000000000000000000000000000000000000000000000000007',
  NOW() - INTERVAL '5 minutes'
);

-- raw_json 의 모든 period block 비어있음 → /api/dashboard 응답 overview=null
INSERT INTO user_snapshots (
  user_id, raw_json, total_cost, sessions_count, calls_count,
  cache_hit_pct, overall_one_shot,
  current_week_raw_json, current_week_start,
  current_month_raw_json, current_month_start,
  current_day_raw_json, current_day_start
) VALUES (
  11,
  '{"week":null,"today":null,"month":null,"all":null}'::jsonb,
  0, 0, 0, 0, 0,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date
);

SELECT setval('users_id_seq', 100);

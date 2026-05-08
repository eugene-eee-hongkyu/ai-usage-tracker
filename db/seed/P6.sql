-- P6 — ccusage-missing (orange ❌). C-1 §2 P6.
-- raw_json 의 ccusageDaily 키 없음 + ccusageMissing:true → 주황 배지.

TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at)
VALUES (
  15,
  'gh-p6-dave',
  'dave@iskra.world',
  'Dave',
  'Asia/Singapore',
  'sha256:0000000000000000000000000000000000000000000000000000000000000006',
  NOW()
);

INSERT INTO user_snapshots (
  user_id, raw_json, total_cost, sessions_count, calls_count,
  cache_hit_pct, overall_one_shot,
  current_week_raw_json, current_week_start,
  current_month_raw_json, current_month_start,
  current_day_raw_json, current_day_start
) VALUES (
  15,
  jsonb_build_object(
    'all', jsonb_build_object(
      'daily', '[]'::jsonb,
      'overview', jsonb_build_object('totalCost', 50, 'sessionsCount', 10, 'callsCount', 200, 'cacheHitPct', 80, 'overallOneShot', 0.7),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb
    ),
    'today', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 0, 'sessionsCount', 0, 'callsCount', 0, 'cacheHitPct', 0, 'overallOneShot', 0),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'week', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 0, 'sessionsCount', 0, 'callsCount', 0, 'cacheHitPct', 0, 'overallOneShot', 0),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'month', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 0, 'sessionsCount', 0, 'callsCount', 0, 'cacheHitPct', 0, 'overallOneShot', 0),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'ccusageMissing', true
  ),
  50, 10, 200, 80, 0.7,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date
);

SELECT setval('users_id_seq', 100);

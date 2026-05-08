-- P4 — stale-2일 (yellow). C-1 §2 P4.
-- last_synced_at = NOW() - 60h ≈ 2.5d → SyncBadge yellow.

TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at)
VALUES (
  13,
  'gh-p4-bob',
  'bob@iskra.world',
  'Bob',
  'Asia/Singapore',
  'sha256:0000000000000000000000000000000000000000000000000000000000000004',
  NOW() - INTERVAL '60 hours'
);

INSERT INTO user_snapshots (
  user_id, raw_json, total_cost, sessions_count, calls_count,
  cache_hit_pct, overall_one_shot,
  current_week_raw_json, current_week_start,
  current_month_raw_json, current_month_start,
  current_day_raw_json, current_day_start
) VALUES (
  13,
  jsonb_build_object(
    'all', jsonb_build_object(
      'daily', '[]'::jsonb,
      'overview', jsonb_build_object('totalCost', 100, 'sessionsCount', 20, 'callsCount', 400, 'cacheHitPct', 85, 'overallOneShot', 0.75),
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
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb)
  ),
  100, 20, 400, 85, 0.75,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date
);

SELECT setval('users_id_seq', 100);

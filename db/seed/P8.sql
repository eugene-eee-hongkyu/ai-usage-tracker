-- P8 — 신규-어드민 (admin email + no snapshot). C-1 §2 P8.
-- /dashboard 진입 시 lastSyncedAt=null → /setup 리다이렉트.

TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

-- admin 본인 (snapshot 없음)
INSERT INTO users (id, github_id, email, name, timezone, api_key_hash)
VALUES (
  12,
  'gh-p8-eugene',
  'eugene.eee@iskra.world',
  'Eugene',
  'Asia/Seoul',
  'sha256:0000000000000000000000000000000000000000000000000000000000000008'
);

-- 다른 멤버 (셀렉터 옵션 확보용 — P2 alice)
INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at)
VALUES (
  10,
  'gh-p8-alice',
  'alice@iskra.world',
  'Alice',
  'Asia/Singapore',
  'sha256:000000000000000000000000000000000000000000000000000000000000000a',
  NOW()
);

INSERT INTO user_snapshots (
  user_id, raw_json, total_cost, sessions_count, calls_count,
  cache_hit_pct, overall_one_shot,
  current_week_raw_json, current_week_start,
  current_month_raw_json, current_month_start,
  current_day_raw_json, current_day_start
) VALUES (
  10,
  jsonb_build_object(
    'all', jsonb_build_object(
      'daily', '[]'::jsonb,
      'overview', jsonb_build_object('totalCost', 100, 'sessionsCount', 20, 'callsCount', 400, 'cacheHitPct', 90, 'overallOneShot', 0.8),
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
  100, 20, 400, 90, 0.8,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date
);

SELECT setval('users_id_seq', 100);

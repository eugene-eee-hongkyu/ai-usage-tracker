-- P3 — 정상-어드민 (P2 + admin email + daily_visits). C-1 §2 P3.
-- ADMIN_EMAIL=eugene.eee@iskra.world 매칭 (web/src/lib/admin.ts:1).

TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at)
VALUES (
  12,
  'gh-p3-eugene',
  'eugene.eee@iskra.world',
  'Eugene',
  'Asia/Seoul',
  'sha256:0000000000000000000000000000000000000000000000000000000000000003',
  NOW()
);

INSERT INTO user_snapshots (
  user_id, raw_json, total_cost, sessions_count, calls_count,
  cache_hit_pct, overall_one_shot,
  current_week_raw_json, current_week_start,
  current_month_raw_json, current_month_start,
  current_day_raw_json, current_day_start
) VALUES (
  12,
  jsonb_build_object(
    'all', jsonb_build_object(
      'daily', (
        SELECT jsonb_agg(
          jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'cost', 14.5, 'sessions', 3)
          ORDER BY d
        )
        FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d
      ),
      'overview', jsonb_build_object('totalCost', 423.78, 'sessionsCount', 92, 'callsCount', 1840, 'cacheHitPct', 91.4, 'overallOneShot', 0.83),
      'projects', jsonb_build_array(
        jsonb_build_object('name', 'project-a', 'cost', 200.5, 'sessions', 40, 'avgCost', 5.0),
        jsonb_build_object('name', 'project-b', 'cost', 150.2, 'sessions', 35, 'avgCost', 4.3),
        jsonb_build_object('name', 'project-c', 'cost', 73.08, 'sessions', 17, 'avgCost', 4.3)
      ),
      'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb
    ),
    'today', jsonb_build_object(
      'daily', jsonb_build_array(jsonb_build_object('date', to_char(NOW()::date, 'YYYY-MM-DD'), 'cost', 14.5, 'sessions', 3)),
      'overview', jsonb_build_object('totalCost', 14.5, 'sessionsCount', 3, 'callsCount', 60, 'cacheHitPct', 91.4, 'overallOneShot', 0.83),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb
    ),
    'week', jsonb_build_object(
      'daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 100, 'sessionsCount', 20, 'callsCount', 400, 'cacheHitPct', 91.4, 'overallOneShot', 0.83),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb
    ),
    'month', jsonb_build_object(
      'daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 423.78, 'sessionsCount', 92, 'callsCount', 1840, 'cacheHitPct', 91.4, 'overallOneShot', 0.83),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb
    )
  ),
  423.78, 92, 1840, 91.4, 0.83,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date
);

-- daily_visits (오늘 5회 + 어제 3회 + 그제 1회) — Engagement card
INSERT INTO daily_visits (user_id, date, count, total_dwell_seconds) VALUES
  (12, NOW()::date, 5, 1240),
  (12, NOW()::date - INTERVAL '1 day', 3, 820),
  (12, NOW()::date - INTERVAL '2 day', 1, 200);

SELECT setval('users_id_seq', 100);

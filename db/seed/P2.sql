-- P2 — 정상-일반 (full data, alice@iskra.world id=10). C-1 §2 P2.
-- 30일 daily, 105일 heatmap (15주), projects 3개, 페르소나 streak 양수.

TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at)
VALUES (
  10,
  'gh-p2-alice',
  'alice@iskra.world',
  'Alice',
  'Asia/Singapore',
  'sha256:0000000000000000000000000000000000000000000000000000000000000001',
  NOW()
);

-- daily 30일 + projects (members API 가 raw_json.all.daily 또는 daily_agg 에서 추출)
-- /api/members/[userId] 응답 shape: { user, summary, daily, streak, projects, canViewFullDashboard }
-- 핵심: total_cost, sessions_count, calls_count, cache_hit_pct, raw_json.all.daily, raw_json.all.projects
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
      'daily', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', to_char(d::date, 'YYYY-MM-DD'),
            'cost', 14.5,
            'sessions', 3
          )
          ORDER BY d
        )
        FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d
      ),
      'overview', jsonb_build_object(
        'totalCost', 423.78,
        'sessionsCount', 92,
        'callsCount', 1840,
        'cacheHitPct', 91.4,
        'overallOneShot', 0.83,
        'costPerCall', 0.039,
        'outputInputRatio', 30
      ),
      'projects', jsonb_build_array(
        jsonb_build_object('name', 'project-a', 'cost', 200.5, 'sessions', 40, 'avgCost', 5.0),
        jsonb_build_object('name', 'project-b', 'cost', 150.2, 'sessions', 35, 'avgCost', 4.3),
        jsonb_build_object('name', 'project-c', 'cost', 73.08, 'sessions', 17, 'avgCost', 4.3)
      ),
      'activities', '[]'::jsonb,
      'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb,
      'tools', '[]'::jsonb,
      'shellCommands', '[]'::jsonb,
      'mcpServers', '[]'::jsonb
    ),
    'today', jsonb_build_object(
      'daily', jsonb_build_array(
        jsonb_build_object('date', to_char(NOW()::date, 'YYYY-MM-DD'), 'cost', 14.5, 'sessions', 3)
      ),
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
    ),
    'ccusageDaily', jsonb_build_object(
      'daily', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', to_char(d::date, 'YYYY-MM-DD'),
            'totalTokens', 100000,
            'totalCost', 14.5
          )
          ORDER BY d
        )
        FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d
      )
    )
  ),
  423.78, 92, 1840, 91.4, 0.83,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date
);

-- 시퀀스 재정렬 (id=10 다음 INSERT 충돌 방지)
SELECT setval('users_id_seq', 100);

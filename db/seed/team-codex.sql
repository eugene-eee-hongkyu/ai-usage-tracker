-- team-codex — Codex 분리 검증용 mixed 멤버 team.
-- 멤버:
--   user_id=30  eugene.eee@iskra.world  (admin, owner, ADMIN_EMAIL 일치 → platform admin)
--               plan_tier='max5' + codex_plan_tier='pro' — 둘 다 입력됨 (modal 안 뜸 검증)
--   user_id=31  oreo@iskra.world         (member, Codex 사용 — codex 탭에 보임)
--               plan_tier=NULL + codex_plan_tier='plus'
--   user_id=32  bob@iskra.world          (member, Claude only — codex 탭에 안 보임)
--               plan_tier='pro' + codex_plan_tier=NULL
--
-- 2026-05-30: multi-tenant 호환 (team_id NOT NULL) — 새 fixture.
-- e2e codex spec 전용.

TRUNCATE users, user_snapshots, period_snapshots, daily_visits, teams, team_members, api_tokens, user_blocks RESTART IDENTITY CASCADE;

-- ── teams ─────────────────────────────────────────────────
INSERT INTO teams (id, name, slug, owner_id, created_at) VALUES
  (30, 'Codex Mixed Team', 'codex-mixed', 30, NOW());

-- ── users ─────────────────────────────────────────────────
INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at, plan_tier, codex_plan_tier) VALUES
  (30, 'gh-tc-eugene', 'eugene.eee@iskra.world', 'Eugene', 'Asia/Seoul', 'sha256:0000000000000000000000000000000000000000000000000000000000000030', NOW(), 'max5', 'pro'),
  (31, 'gh-tc-oreo',   'oreo@iskra.world',       'Oreo',   'Asia/Seoul', 'sha256:0000000000000000000000000000000000000000000000000000000000000031', NOW(), NULL,   'plus'),
  (32, 'gh-tc-bob',    'bob@iskra.world',        'Bob',    'Asia/Seoul', 'sha256:0000000000000000000000000000000000000000000000000000000000000032', NOW(), 'pro',  NULL);

-- ── team_members ──────────────────────────────────────────
INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES
  (30, 30, 'owner',  NOW()),
  (30, 31, 'member', NOW()),
  (30, 32, 'member', NOW());

-- ── api_tokens (per-user 1대, cliVersion 0.3.1) ────────────
INSERT INTO api_tokens (id, user_id, name, hash, metadata, last_used_at) VALUES
  (200, 30, 'eugene device', 'sha256:token-tc-200', jsonb_build_object('platform', 'darwin', 'cliVersion', '0.3.1'), NOW()),
  (201, 31, 'oreo device',   'sha256:token-tc-201', jsonb_build_object('platform', 'darwin', 'cliVersion', '0.3.1'), NOW()),
  (202, 32, 'bob device',    'sha256:token-tc-202', jsonb_build_object('platform', 'darwin', 'cliVersion', '0.3.1'), NOW());

-- ── user_snapshots ────────────────────────────────────────
-- raw_json 최소 shape (overview + ccusageDaily 30일) helper function 으로.
-- 한 user 마다 provider 별 행 N개.

-- eugene: claude (cost 300, sessions 60) + codex (cost 200, sessions 40)
INSERT INTO user_snapshots (team_id, user_id, token_id, provider, raw_json, total_cost, sessions_count, calls_count, cache_hit_pct, overall_one_shot) VALUES
  (30, 30, 200, 'claude',
   jsonb_build_object(
     'all', jsonb_build_object('daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'cost', 10, 'sessions', 2) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d),
       'overview', jsonb_build_object('totalCost', 300, 'sessionsCount', 60, 'callsCount', 1200, 'cacheHitPct', 90, 'overallOneShot', 0.8),
       'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'today', jsonb_build_object('daily', jsonb_build_array(jsonb_build_object('date', to_char(NOW()::date, 'YYYY-MM-DD'), 'cost', 10, 'sessions', 2)), 'overview', jsonb_build_object('totalCost', 10, 'sessionsCount', 2, 'callsCount', 30, 'cacheHitPct', 90, 'overallOneShot', 0.8), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'week', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 70, 'sessionsCount', 14, 'callsCount', 280, 'cacheHitPct', 90, 'overallOneShot', 0.8), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'month', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 300, 'sessionsCount', 60, 'callsCount', 1200, 'cacheHitPct', 90, 'overallOneShot', 0.8), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'ccusageDaily', jsonb_build_object('daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'totalTokens', 100000, 'totalCost', 10) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d))
   ),
   300, 60, 1200, 90, 0.8),
  (30, 30, 200, 'codex',
   jsonb_build_object(
     'all', jsonb_build_object('daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'cost', 7, 'sessions', 1) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d),
       'overview', jsonb_build_object('totalCost', 200, 'sessionsCount', 40, 'callsCount', 600, 'cacheHitPct', 70, 'overallOneShot', 0.85),
       'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'today', jsonb_build_object('daily', jsonb_build_array(jsonb_build_object('date', to_char(NOW()::date, 'YYYY-MM-DD'), 'cost', 7, 'sessions', 1)), 'overview', jsonb_build_object('totalCost', 7, 'sessionsCount', 1, 'callsCount', 15, 'cacheHitPct', 70, 'overallOneShot', 0.85), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'week', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 49, 'sessionsCount', 8, 'callsCount', 140, 'cacheHitPct', 70, 'overallOneShot', 0.85), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'month', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 200, 'sessionsCount', 40, 'callsCount', 600, 'cacheHitPct', 70, 'overallOneShot', 0.85), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'ccusageDaily', jsonb_build_object('daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'totalTokens', 70000, 'totalCost', 7) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d))
   ),
   200, 40, 600, 70, 0.85);

-- oreo: codex 만 (cost 100, sessions 20)
INSERT INTO user_snapshots (team_id, user_id, token_id, provider, raw_json, total_cost, sessions_count, calls_count, cache_hit_pct, overall_one_shot) VALUES
  (30, 31, 201, 'codex',
   jsonb_build_object(
     'all', jsonb_build_object('daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'cost', 3.5, 'sessions', 1) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d),
       'overview', jsonb_build_object('totalCost', 100, 'sessionsCount', 20, 'callsCount', 300, 'cacheHitPct', 65, 'overallOneShot', 0.78),
       'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'today', jsonb_build_object('daily', jsonb_build_array(jsonb_build_object('date', to_char(NOW()::date, 'YYYY-MM-DD'), 'cost', 3.5, 'sessions', 1)), 'overview', jsonb_build_object('totalCost', 3.5, 'sessionsCount', 1, 'callsCount', 10, 'cacheHitPct', 65, 'overallOneShot', 0.78), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'week', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 24, 'sessionsCount', 5, 'callsCount', 70, 'cacheHitPct', 65, 'overallOneShot', 0.78), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'month', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 100, 'sessionsCount', 20, 'callsCount', 300, 'cacheHitPct', 65, 'overallOneShot', 0.78), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'ccusageDaily', jsonb_build_object('daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'totalTokens', 50000, 'totalCost', 3.5) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d))
   ),
   100, 20, 300, 65, 0.78);

-- bob: claude 만 (cost 80, sessions 16)
INSERT INTO user_snapshots (team_id, user_id, token_id, provider, raw_json, total_cost, sessions_count, calls_count, cache_hit_pct, overall_one_shot) VALUES
  (30, 32, 202, 'claude',
   jsonb_build_object(
     'all', jsonb_build_object('daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'cost', 2.7, 'sessions', 1) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d),
       'overview', jsonb_build_object('totalCost', 80, 'sessionsCount', 16, 'callsCount', 250, 'cacheHitPct', 85, 'overallOneShot', 0.82),
       'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'today', jsonb_build_object('daily', jsonb_build_array(jsonb_build_object('date', to_char(NOW()::date, 'YYYY-MM-DD'), 'cost', 2.7, 'sessions', 1)), 'overview', jsonb_build_object('totalCost', 2.7, 'sessionsCount', 1, 'callsCount', 8, 'cacheHitPct', 85, 'overallOneShot', 0.82), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'week', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 19, 'sessionsCount', 4, 'callsCount', 60, 'cacheHitPct', 85, 'overallOneShot', 0.82), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'month', jsonb_build_object('daily', '[]'::jsonb, 'overview', jsonb_build_object('totalCost', 80, 'sessionsCount', 16, 'callsCount', 250, 'cacheHitPct', 85, 'overallOneShot', 0.82), 'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb, 'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
     'ccusageDaily', jsonb_build_object('daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'totalTokens', 40000, 'totalCost', 2.7) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d))
   ),
   80, 16, 250, 85, 0.82);

SELECT setval('users_id_seq', 200);
SELECT setval('teams_id_seq', 200);
SELECT setval('api_tokens_id_seq', 1000);

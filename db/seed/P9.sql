-- P9 — Codex 사용자 (personal, claude + codex 양쪽 데이터).
-- email: p9@iskra.world, user_id=20, team_id=20
-- planTier = 'pro' (Claude 입력됨)
-- codex_plan_tier = NULL (Codex 미입력 → Codex 탭 진입 시 modal 자동 open 검증)
-- 새 fixture (2026-05-30): multi-tenant 호환, supportsMultiProvider=true (cliVersion 0.3.1).
-- personal=true → /ranking 페이지에 노출.

TRUNCATE users, user_snapshots, period_snapshots, daily_visits, teams, team_members, api_tokens, user_blocks RESTART IDENTITY CASCADE;

INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at, personal, plan_tier, codex_plan_tier)
VALUES (
  20,
  'gh-p9-codex',
  'p9@iskra.world',
  'P9 Codex User',
  'Asia/Seoul',
  'sha256:0000000000000000000000000000000000000000000000000000000000000099',
  NOW(),
  true,
  'pro',         -- Claude tier 입력됨
  NULL           -- Codex tier 미입력 (modal 자동 trigger 검증용)
);

INSERT INTO teams (id, name, slug, owner_id, created_at)
VALUES (20, 'p9-team', 'p9-team', 20, NOW());

INSERT INTO team_members (team_id, user_id, role, joined_at)
VALUES (20, 20, 'owner', NOW());

-- api_tokens: device 1대, cliVersion 0.3.1 (supportsMultiProvider=true)
INSERT INTO api_tokens (id, user_id, name, hash, metadata, last_used_at)
VALUES (
  100,
  20,
  'P9 device',
  'sha256:token-p9-100',
  jsonb_build_object('platform', 'darwin', 'cliVersion', '0.3.1'),
  NOW()
);

-- user_snapshots: claude provider (cost 200, sessions 50)
INSERT INTO user_snapshots (
  team_id, user_id, token_id, provider,
  raw_json, total_cost, sessions_count, calls_count,
  cache_hit_pct, overall_one_shot
) VALUES (
  20, 20, 100, 'claude',
  jsonb_build_object(
    'all', jsonb_build_object(
      'daily', (
        SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'cost', 7.0, 'sessions', 2) ORDER BY d)
        FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d
      ),
      'overview', jsonb_build_object('totalCost', 200.0, 'sessionsCount', 50, 'callsCount', 1000, 'cacheHitPct', 90.0, 'overallOneShot', 0.80),
      'projects', '[]'::jsonb,
      'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb
    ),
    'today', jsonb_build_object('daily', jsonb_build_array(jsonb_build_object('date', to_char(NOW()::date, 'YYYY-MM-DD'), 'cost', 7.0, 'sessions', 2)),
      'overview', jsonb_build_object('totalCost', 7.0, 'sessionsCount', 2, 'callsCount', 30, 'cacheHitPct', 90.0, 'overallOneShot', 0.80),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'week', jsonb_build_object('daily', '[]'::jsonb,
      'overview', jsonb_build_object('totalCost', 50.0, 'sessionsCount', 12, 'callsCount', 240, 'cacheHitPct', 90.0, 'overallOneShot', 0.80),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'month', jsonb_build_object('daily', '[]'::jsonb,
      'overview', jsonb_build_object('totalCost', 200.0, 'sessionsCount', 50, 'callsCount', 1000, 'cacheHitPct', 90.0, 'overallOneShot', 0.80),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'ccusageDaily', jsonb_build_object('daily', (
      SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'totalTokens', 80000, 'totalCost', 7.0) ORDER BY d)
      FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d
    ))
  ),
  200.0, 50, 1000, 90.0, 0.80
);

-- user_snapshots: codex provider (cost 150, sessions 40)
INSERT INTO user_snapshots (
  team_id, user_id, token_id, provider,
  raw_json, total_cost, sessions_count, calls_count,
  cache_hit_pct, overall_one_shot
) VALUES (
  20, 20, 100, 'codex',
  jsonb_build_object(
    'all', jsonb_build_object(
      'daily', (
        SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'cost', 5.0, 'sessions', 1) ORDER BY d)
        FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d
      ),
      'overview', jsonb_build_object('totalCost', 150.0, 'sessionsCount', 40, 'callsCount', 600, 'cacheHitPct', 70.0, 'overallOneShot', 0.85),
      'projects', '[]'::jsonb,
      'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb
    ),
    'today', jsonb_build_object('daily', jsonb_build_array(jsonb_build_object('date', to_char(NOW()::date, 'YYYY-MM-DD'), 'cost', 5.0, 'sessions', 1)),
      'overview', jsonb_build_object('totalCost', 5.0, 'sessionsCount', 1, 'callsCount', 15, 'cacheHitPct', 70.0, 'overallOneShot', 0.85),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'week', jsonb_build_object('daily', '[]'::jsonb,
      'overview', jsonb_build_object('totalCost', 35.0, 'sessionsCount', 8, 'callsCount', 140, 'cacheHitPct', 70.0, 'overallOneShot', 0.85),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'month', jsonb_build_object('daily', '[]'::jsonb,
      'overview', jsonb_build_object('totalCost', 150.0, 'sessionsCount', 40, 'callsCount', 600, 'cacheHitPct', 70.0, 'overallOneShot', 0.85),
      'projects', '[]'::jsonb, 'activities', '[]'::jsonb, 'topSessions', '[]'::jsonb,
      'models', '[]'::jsonb, 'tools', '[]'::jsonb, 'shellCommands', '[]'::jsonb, 'mcpServers', '[]'::jsonb),
    'ccusageDaily', jsonb_build_object('daily', (
      SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'totalTokens', 50000, 'totalCost', 5.0) ORDER BY d)
      FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d
    ))
  ),
  150.0, 40, 600, 70.0, 0.85
);

-- 시퀀스 정렬 (다음 INSERT id 충돌 방지)
SELECT setval('users_id_seq', 100);
SELECT setval('teams_id_seq', 100);
SELECT setval('api_tokens_id_seq', 1000);

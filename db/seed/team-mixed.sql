-- team-mixed — TM 모듈 검증용 다양한 페르소나 한 번에 시드.
--   id=10 P2 alice (정상-일반)
--   id=12 P3 eugene (admin, 정상)
--   id=13 P4 bob (stale-2일 yellow)
--   id=14 P5 carol (stale-7일+ red ⚠)
--   id=15 P6 dave (ccusage-missing)
-- daily_visits: P3 본인 + 멤버들 visit 데이터 (Engagement 카드 검증).

TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

-- ── users ────────────────────────────────────────────
INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at) VALUES
  (10, 'gh-mix-alice',  'alice@iskra.world',        'Alice',  'Asia/Singapore', 'sha256:000000000000000000000000000000000000000000000000000000000000000a', NOW()),
  (12, 'gh-mix-eugene', 'eugene.eee@iskra.world',   'Eugene', 'Asia/Seoul',     'sha256:000000000000000000000000000000000000000000000000000000000000000c', NOW()),
  (13, 'gh-mix-bob',    'bob@iskra.world',          'Bob',    'Asia/Singapore', 'sha256:000000000000000000000000000000000000000000000000000000000000000d', NOW() - INTERVAL '60 hours'),
  (14, 'gh-mix-carol',  'carol@iskra.world',        'Carol',  'Asia/Singapore', 'sha256:000000000000000000000000000000000000000000000000000000000000000e', NOW() - INTERVAL '8 days'),
  (15, 'gh-mix-dave',   'dave@iskra.world',         'Dave',   'Asia/Singapore', 'sha256:000000000000000000000000000000000000000000000000000000000000000f', NOW());

-- ── user_snapshots ───────────────────────────────────
-- 공통 raw shape (P2 와 같은 구조, 비용/세션만 다름) — ccusageDaily 30일 시드
INSERT INTO user_snapshots (
  user_id, raw_json, total_cost, sessions_count, calls_count, cache_hit_pct, overall_one_shot,
  current_week_raw_json, current_week_start,
  current_month_raw_json, current_month_start,
  current_day_raw_json, current_day_start
)
SELECT
  m.user_id,
  jsonb_build_object(
    'all', jsonb_build_object(
      'daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'cost', m.daily_cost, 'sessions', 3) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d),
      'overview', jsonb_build_object('totalCost', m.total_cost, 'sessionsCount', m.sess, 'callsCount', m.calls, 'cacheHitPct', m.cache, 'overallOneShot', m.oneshot),
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
    'ccusageDaily', jsonb_build_object(
      'daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d::date, 'YYYY-MM-DD'), 'totalTokens', 100000, 'totalCost', m.daily_cost) ORDER BY d) FROM generate_series(NOW()::date - INTERVAL '29 days', NOW()::date, '1 day') d)
    )
  ) || (CASE WHEN m.ccusage_missing THEN jsonb_build_object('ccusageMissing', true) ELSE '{}'::jsonb END),
  m.total_cost, m.sess, m.calls, m.cache, m.oneshot,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date,
  '{}'::jsonb, NOW()::date
FROM (VALUES
  -- user_id, total_cost, sess, calls, cache, oneshot, daily_cost, ccusage_missing
  (10::int, 423.78::real, 92, 1840, 91.4::real, 0.83::real, 14.5::real, false),
  (12::int, 380.0::real,  85, 1700, 90.0::real, 0.80::real, 13.0::real, false),
  (13::int, 100.0::real,  20, 400,  85.0::real, 0.75::real, 3.5::real,  false),
  (14::int, 50.0::real,   10, 200,  80.0::real, 0.70::real, 1.7::real,  false),
  (15::int, 50.0::real,   10, 200,  80.0::real, 0.70::real, 1.7::real,  true)
) AS m(user_id, total_cost, sess, calls, cache, oneshot, daily_cost, ccusage_missing);

-- ccusage missing 인 P6 의 raw_json 에서 ccusageDaily 키 제거
UPDATE user_snapshots
SET raw_json = raw_json - 'ccusageDaily'
WHERE user_id = 15;

-- ── daily_visits ─────────────────────────────────────
-- P3 admin 시점 — 멤버들 monthVisits / avgDwellSec
INSERT INTO daily_visits (user_id, date, count, total_dwell_seconds) VALUES
  (10, NOW()::date,                             5, 1240),
  (10, NOW()::date - INTERVAL '1 day',          3,  820),
  (12, NOW()::date,                             4, 1500),
  (13, NOW()::date,                             2,  600),
  (14, NOW()::date,                             0,    0),
  (15, NOW()::date,                             1,  300);

SELECT setval('users_id_seq', 100);

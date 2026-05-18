-- ============================================================================
-- Phase 4.2 M6a — multi-tenant 도입
-- ============================================================================
--
-- 목표:
--   - teams + team_members 신규 테이블
--   - 8 데이터 테이블 (users 제외) + audit_logs 까지 총 9 테이블에 team_id FK 추가
--   - 기존 5 active user 모두 "iskra.world" (id=1) 팀에 backfill
--   - 기존 unique constraint (예: user_snapshots.user_id) → team-scoped 로 확장
--
-- 적용 순서 (idempotent 의도, 단 ALTER NOT NULL 은 backfill 후에야 가능):
--   1) CREATE teams + team_members
--   2) INSERT 기본 팀 (iskra.world, owner_id=1) + team_members backfill
--   3) ALTER ADD COLUMN team_id NULL 8 + audit_logs
--   4) UPDATE backfill SET team_id = 1 WHERE team_id IS NULL
--   5) ALTER ALTER COLUMN team_id SET NOT NULL + ADD FK
--   6) DROP 기존 unique constraint + CREATE team-scoped unique
--   7) CREATE 추가 indexes
--
-- audit_logs trigger (audit_chain_hash) 의 hash 입력은 변경 없음 — team_id 는
-- hash 입력에서 제외 (옛 row 의 chain 보존, forensic 강화는 후속 작업).

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) teams + team_members 신규
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL,
  owner_id    integer NOT NULL REFERENCES users(id),
  created_at  timestamp DEFAULT NOW() NOT NULL,
  deleted_at  timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_slug_uniq ON teams(slug);
CREATE INDEX IF NOT EXISTS teams_owner_idx ON teams(owner_id);

CREATE TABLE IF NOT EXISTS team_members (
  id          serial PRIMARY KEY,
  team_id     integer NOT NULL REFERENCES teams(id),
  user_id     integer NOT NULL REFERENCES users(id),
  role        text NOT NULL DEFAULT 'member',
  joined_at   timestamp DEFAULT NOW() NOT NULL,
  deleted_at  timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_user_uniq ON team_members(team_id, user_id);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members(user_id);

-- ----------------------------------------------------------------------------
-- 2) backfill — iskra.world 기본 팀 + 모든 active user 멤버십
-- ----------------------------------------------------------------------------
INSERT INTO teams (id, name, slug, owner_id)
VALUES (1, 'iskra.world', 'iskra-world', 1)
ON CONFLICT (id) DO NOTHING;

-- sequence 갱신 (다음 INSERT 가 id=2 부터 가도록)
SELECT setval(pg_get_serial_sequence('teams', 'id'), GREATEST(1, (SELECT COALESCE(MAX(id), 0) FROM teams)));

INSERT INTO team_members (team_id, user_id, role)
SELECT
  1,
  id,
  CASE WHEN id = 1 THEN 'owner' ELSE 'member' END
FROM users
WHERE deleted_at IS NULL
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) 9 데이터 테이블에 team_id 컬럼 추가 (nullable 로 시작)
-- ----------------------------------------------------------------------------
ALTER TABLE invitations       ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE join_requests     ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE api_tokens        ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE audit_logs        ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE user_snapshots    ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE period_snapshots  ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE user_blocks       ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE daily_visits      ADD COLUMN IF NOT EXISTS team_id integer;

-- ----------------------------------------------------------------------------
-- 4) backfill — 모든 기존 행 → team_id = 1 (iskra.world)
-- ----------------------------------------------------------------------------
UPDATE invitations       SET team_id = 1 WHERE team_id IS NULL;
UPDATE join_requests     SET team_id = 1 WHERE team_id IS NULL;
UPDATE api_tokens        SET team_id = 1 WHERE team_id IS NULL;
UPDATE audit_logs        SET team_id = 1 WHERE team_id IS NULL;
UPDATE user_snapshots    SET team_id = 1 WHERE team_id IS NULL;
UPDATE period_snapshots  SET team_id = 1 WHERE team_id IS NULL;
UPDATE user_blocks       SET team_id = 1 WHERE team_id IS NULL;
UPDATE daily_visits      SET team_id = 1 WHERE team_id IS NULL;

-- ----------------------------------------------------------------------------
-- 5) NOT NULL + FK 추가
-- ----------------------------------------------------------------------------
ALTER TABLE invitations       ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE join_requests     ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE api_tokens        ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE audit_logs        ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE user_snapshots    ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE period_snapshots  ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE user_blocks       ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE daily_visits      ALTER COLUMN team_id SET NOT NULL;

-- FK 는 중복 방지 (재실행 안전)
DO $$ BEGIN
  ALTER TABLE invitations       ADD CONSTRAINT invitations_team_id_fkey       FOREIGN KEY (team_id) REFERENCES teams(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE join_requests     ADD CONSTRAINT join_requests_team_id_fkey     FOREIGN KEY (team_id) REFERENCES teams(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE api_tokens        ADD CONSTRAINT api_tokens_team_id_fkey        FOREIGN KEY (team_id) REFERENCES teams(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE audit_logs        ADD CONSTRAINT audit_logs_team_id_fkey        FOREIGN KEY (team_id) REFERENCES teams(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE user_snapshots    ADD CONSTRAINT user_snapshots_team_id_fkey    FOREIGN KEY (team_id) REFERENCES teams(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE period_snapshots  ADD CONSTRAINT period_snapshots_team_id_fkey  FOREIGN KEY (team_id) REFERENCES teams(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE user_blocks       ADD CONSTRAINT user_blocks_team_id_fkey       FOREIGN KEY (team_id) REFERENCES teams(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE daily_visits      ADD CONSTRAINT daily_visits_team_id_fkey      FOREIGN KEY (team_id) REFERENCES teams(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 6) 기존 unique constraint → team-scoped 로 확장
--    (M6a 에선 모든 user 가 1팀이라 동작 동일. M6b 에서 N팀 가입 시 의미 가짐)
-- ----------------------------------------------------------------------------

-- user_snapshots: (user_id) → (user_id, team_id)
DROP INDEX IF EXISTS user_snapshots_user_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS user_snapshots_user_team_uniq ON user_snapshots(user_id, team_id);

-- period_snapshots: (user_id, period_type, period_start) → (user_id, team_id, period_type, period_start)
DROP INDEX IF EXISTS period_snapshots_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS period_snapshots_uniq ON period_snapshots(user_id, team_id, period_type, period_start);

-- user_blocks: (user_id, block_id) → (user_id, team_id, block_id)
DROP INDEX IF EXISTS user_blocks_user_block_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_user_team_block_uniq ON user_blocks(user_id, team_id, block_id);

-- daily_visits: (user_id, date) → (user_id, team_id, date)
DROP INDEX IF EXISTS daily_visits_user_date_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS daily_visits_user_team_date_uniq ON daily_visits(user_id, team_id, date);

-- ----------------------------------------------------------------------------
-- 7) team_id 보조 인덱스 (조회 성능)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS invitations_team_idx       ON invitations(team_id);
CREATE INDEX IF NOT EXISTS join_requests_team_idx     ON join_requests(team_id);
CREATE INDEX IF NOT EXISTS api_tokens_team_idx        ON api_tokens(team_id);
CREATE INDEX IF NOT EXISTS audit_logs_team_idx        ON audit_logs(team_id);
CREATE INDEX IF NOT EXISTS user_snapshots_team_idx    ON user_snapshots(team_id);
CREATE INDEX IF NOT EXISTS period_snapshots_team_idx  ON period_snapshots(team_id);
CREATE INDEX IF NOT EXISTS user_blocks_team_idx       ON user_blocks(team_id);
CREATE INDEX IF NOT EXISTS daily_visits_team_idx      ON daily_visits(team_id);

-- ----------------------------------------------------------------------------
-- 8) teams / team_members RLS 활성 (정책은 별도 SQL 에서 작성 — 단계 3)
-- ----------------------------------------------------------------------------
ALTER TABLE teams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members  ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Multi-provider ingest (2026-05-29) — provider 컬럼 + 식별 인덱스 확장.
--
-- 배경: codeburn / ccusage 가 Claude + Codex (+ Gemini 등) 모두 보낼 수 있는 binary.
-- 우리 ingest 가 현재 ccusage `daily --json` (default = 모든 provider 합산) +
-- codeburn `--provider claude` (명시) 혼용 → ccusage 의 default 합산 때문에
-- 영향 user (oreo / Youngjin Kim / 송화중) 의 ccusage 데이터가 mixed 상태.
--
-- 진단 결과 (2026-05-29):
--   user_id=2 (oreo): 58 rows mixed (Codex 4종 + Gemini 3종 + 기타)
--   user_id=4 (Youngjin Kim): 39 rows mixed (Codex 4종)
--   user_id=9 (송화중): 32 rows mixed (Codex 4종)
--
-- 이 마이그는 provider 컬럼만 도입. mixed row 폐기는 별도 SQL
-- (0016b_purge_mixed_rows.sql) — Phase 1 코드 배포 후 명시 실행.
--
-- 정책:
--   - provider VARCHAR(20) DEFAULT 'claude' NOT NULL — 기존 row 전부 'claude' 마킹.
--   - 식별 인덱스 = 기존 + provider. NULLS NOT DISTINCT 패턴 그대로 (PG 15+).
--   - 마이그 down 가역: 컬럼 drop + 옛 인덱스 복원.

-- 1) provider 컬럼 추가 (default 'claude' → 기존 row 전부 claude 자동 마킹).
ALTER TABLE user_snapshots ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'claude';
ALTER TABLE period_snapshots ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'claude';
ALTER TABLE user_blocks ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'claude';

-- 2) 옛 식별 인덱스 drop + 새 (provider 포함) 인덱스 생성.
--    NULLS NOT DISTINCT — NULL token_id (legacy fallback) 도 중복 차단 유지.
DROP INDEX IF EXISTS user_snapshots_user_team_token_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS user_snapshots_user_team_token_provider_uniq
  ON user_snapshots (user_id, team_id, token_id, provider) NULLS NOT DISTINCT;

DROP INDEX IF EXISTS period_snapshots_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS period_snapshots_uniq
  ON period_snapshots (user_id, team_id, period_type, period_start, token_id, provider) NULLS NOT DISTINCT;

DROP INDEX IF EXISTS user_blocks_user_team_block_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_user_team_block_provider_uniq
  ON user_blocks (user_id, team_id, block_id, provider) NULLS NOT DISTINCT;

-- 3) provider 조회 인덱스 (dashboard query param 으로 자주 필터).
CREATE INDEX IF NOT EXISTS user_snapshots_provider_idx ON user_snapshots(provider);
CREATE INDEX IF NOT EXISTS period_snapshots_provider_idx ON period_snapshots(provider);
CREATE INDEX IF NOT EXISTS user_blocks_provider_idx ON user_blocks(provider);

-- ─────────────────────────────────────────────────────────────────────────
-- DOWN (회수) — staging 또는 disaster recovery 시 참조:
--
-- DROP INDEX IF EXISTS user_snapshots_provider_idx;
-- DROP INDEX IF EXISTS period_snapshots_provider_idx;
-- DROP INDEX IF EXISTS user_blocks_provider_idx;
--
-- DROP INDEX IF EXISTS user_snapshots_user_team_token_provider_uniq;
-- DROP INDEX IF EXISTS period_snapshots_uniq;
-- DROP INDEX IF EXISTS user_blocks_user_team_block_provider_uniq;
--
-- CREATE UNIQUE INDEX IF NOT EXISTS user_snapshots_user_team_token_uniq
--   ON user_snapshots (user_id, team_id, token_id) NULLS NOT DISTINCT;
-- CREATE UNIQUE INDEX IF NOT EXISTS period_snapshots_uniq
--   ON period_snapshots (user_id, team_id, period_type, period_start, token_id) NULLS NOT DISTINCT;
-- CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_user_team_block_uniq
--   ON user_blocks (user_id, team_id, block_id) NULLS NOT DISTINCT;
--
-- ALTER TABLE user_snapshots DROP COLUMN IF EXISTS provider;
-- ALTER TABLE period_snapshots DROP COLUMN IF EXISTS provider;
-- ALTER TABLE user_blocks DROP COLUMN IF EXISTS provider;

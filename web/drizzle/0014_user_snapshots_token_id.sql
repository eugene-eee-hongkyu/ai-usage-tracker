-- M6f (2026-05-25) device-scope snapshot — 운영 회수 마이그.
--
-- 배경: 운영 Supabase 에는 이미 수동 적용되어 있다 (state.md: 영진님 케이스
-- Mac (token 2) + Windows (token 11) 정상 검증). 이 파일은 staging /
-- disaster recovery / 신규 개발자 환경 재현성 회복을 위한 회수.
--
-- 운영 진단 결과 (2026-05-28):
--   - user_snapshots / period_snapshots 에 token_id integer 컬럼 존재
--   - user_snapshots_user_team_token_uniq: (user_id, team_id, token_id) NULLS NOT DISTINCT
--   - period_snapshots_uniq: (user_id, team_id, period_type, period_start, token_id) NULLS NOT DISTINCT
--   - 옛 user_snapshots_user_team_uniq 는 이미 drop 됨
--
-- 핵심: NULLS NOT DISTINCT (PG 15+) — NULL token_id 끼리도 같은 값으로
-- 취급. 즉 legacy fallback 경로 (token_id IS NULL) row 가 같은 (user_id,
-- team_id) 에 2개 이상 못 들어감. column-list 라 drizzle 의
-- onConflictDoUpdate target [userId, teamId, tokenId] 와 정상 매칭.
--
-- 운영 환경 적용: 이미 컬럼/인덱스 존재 → IF NOT EXISTS / IF EXISTS 가
-- noop 처리. 운영엔 추가 실행 불필요 (진단으로 확정).

-- 1) token_id 컬럼 추가 (device-scope row 분리).
ALTER TABLE user_snapshots ADD COLUMN IF NOT EXISTS token_id integer
  REFERENCES api_tokens(id);
ALTER TABLE period_snapshots ADD COLUMN IF NOT EXISTS token_id integer
  REFERENCES api_tokens(id);

-- 2) 옛 (user_id, team_id) unique 제거 — multi-device 의 N row 가능하도록.
DROP INDEX IF EXISTS user_snapshots_user_team_uniq;

-- 3) 새 unique — NULLS NOT DISTINCT 로 NULL token_id (legacy fallback) 도
--    중복 차단. drizzle ON CONFLICT (column-list) 와 호환.
CREATE UNIQUE INDEX IF NOT EXISTS user_snapshots_user_team_token_uniq
  ON user_snapshots (user_id, team_id, token_id) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS period_snapshots_uniq
  ON period_snapshots (user_id, team_id, period_type, period_start, token_id) NULLS NOT DISTINCT;

-- 4) token_id 조회 최적화 (dashboard device dropdown 의 leftJoin).
CREATE INDEX IF NOT EXISTS user_snapshots_token_idx ON user_snapshots(token_id);
CREATE INDEX IF NOT EXISTS period_snapshots_token_idx ON period_snapshots(token_id);

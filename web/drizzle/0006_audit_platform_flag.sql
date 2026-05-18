-- ============================================================================
-- Phase 4.2 M6c — audit_logs 에 actor_is_platform_owner 플래그
-- ============================================================================
--
-- 목적:
--   platform owner (ADMIN_EMAIL env) 가 view-as 모드에서 다른 팀의 audit
--   액션을 만든 행을 시각적으로 구분. 회사 owner 가 자기 audit 페이지에서
--   "이건 우리 회사 사람이 한 게 아니라 플랫폼 운영자가 한 거" 확인 가능.
--
-- 정의:
--   actor_is_platform_owner = (effective_team_id != actor.current_team_id) 인 경우 true.
--   writeAudit 호출 측이 명시적으로 박을 수 있고, 미입력 시 default false.
--
-- chain hash 보존:
--   기존 audit_chain_hash trigger 의 hash input 에는 포함하지 않는다 (옛 행 그대로).
--   변경된 trigger 없음. 컬럼 추가만.

BEGIN;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_is_platform_owner boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS audit_logs_platform_idx
  ON audit_logs(actor_is_platform_owner)
  WHERE actor_is_platform_owner = true;

COMMIT;

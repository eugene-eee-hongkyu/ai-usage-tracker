-- ============================================================================
-- Phase 4.2 M6d — teams.name_pending: 어드민이 직접 회사명을 정하는 흐름
-- ============================================================================
--
-- 목적:
--   Owner 가 새 팀 생성 시 teamName 을 비워둘 수 있게 함. 비우면 name_pending=TRUE
--   로 INSERT 되고, 그 팀의 어드민이 첫 로그인 후 /onboard-team 화면에서 본인이
--   회사명을 입력 → name UPDATE + name_pending=FALSE.
--
-- 디폴트 정책:
--   default FALSE. 신규 코드만 명시적으로 true 박음. 기존 행은 모두 false 로
--   안전 유지 (백필 누락 사고 방지).
--
-- 백필:
--   2026-05-20 prod 에서 kj@thenexa.io (user_id=7) 를 iskra.world (team_id=1)
--   에서 새 팀 (team_id=2, name='(pending)') 으로 분리하였음. 그 팀만 명시적으로
--   name_pending=TRUE 로 마킹해서 다음 로그인 시 /onboard-team 으로 redirect.

BEGIN;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS name_pending boolean NOT NULL DEFAULT false;

UPDATE teams SET name_pending = TRUE WHERE id = 2 AND name = '(pending)';

COMMIT;

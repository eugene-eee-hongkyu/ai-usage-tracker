-- M6f (2026-05-21): teams.auto_join_domains jsonb — 미초대 OAuth 신규자의 email
-- 도메인이 매칭되면 그 팀 member 로 즉시 가입. Slack/Linear 패턴.
--
-- 백필:
--   iskra.world 팀 (id=1) — 현재 멤버 도메인 ["iskra.world","z21labs.xyz"] 자동 등록.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS auto_join_domains jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE teams
  SET auto_join_domains = '["iskra.world","z21labs.xyz"]'::jsonb
  WHERE id = 1;

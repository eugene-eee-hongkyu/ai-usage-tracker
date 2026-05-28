-- 2026-05-28: Personal 기능 — 개인 사용자 랭킹 인프라.
--
-- 변경:
--   1) users.personal     — true 면 전체 랭킹에 참여 (opt-in). 기존 사용자 false.
--   2) users.ranking_hidden — true 면 어드민이 랭킹에서 숨김.
--   3) teams.type          — 'normal' (기존) | 'personal' (글로벌 personal 팀).
--   4) personal 팀 1개 INSERT.
--
-- auth.ts signIn: invitation / auto-join 모두 실패 → personal 팀 자동 가입.
-- 랭킹 API: users.personal=true AND ranking_hidden=false 인 사용자를 user_id 기준
-- cross-team 으로 집계.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS personal boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ranking_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'normal';

-- personal 팀 — ownerId=1 (platform admin). maxMembers 를 높게 잡아 cap 무제한.
-- slug unique 제약으로 중복 INSERT 방지.
INSERT INTO teams (name, slug, owner_id, type, max_members, name_pending, auto_join_enabled)
  SELECT 'Personal', 'personal', 1, 'personal', 999999, false, false
  WHERE NOT EXISTS (SELECT 1 FROM teams WHERE slug = 'personal');

COMMIT;

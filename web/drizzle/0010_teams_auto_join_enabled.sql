-- M6g (2026-05-21): teams.auto_join_enabled — 자동 가입 toggle.
-- false 면 도메인 매칭돼도 /join 으로. Owner / Platform Admin 만 변경.
-- 기본 true (M6f 와 일관성).

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS auto_join_enabled boolean NOT NULL DEFAULT true;

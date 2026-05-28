-- 2026-05-28: Personal 기능 — SQLite (LOCAL_MODE) schema sync.
-- LOCAL_MODE 는 single-user 라 personal/ranking 사실상 안 쓰지만 schema 일관성 유지.

ALTER TABLE users ADD COLUMN personal integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN ranking_hidden integer NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN type text NOT NULL DEFAULT 'normal';

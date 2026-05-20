-- Phase 4.2 M6d — teams.name_pending (SQLite mirror of drizzle/0007).
-- LOCAL_MODE 는 single-user 라 사실상 늘 false. schema 일관성 위해서만 추가.
ALTER TABLE teams ADD COLUMN name_pending integer NOT NULL DEFAULT 0;

-- M6f/M6g (2026-05-21): teams.auto_join_domains + auto_join_enabled.
-- LOCAL_MODE 는 single-team 이라 사실상 사용 X. schema 일관성 위해서만 추가.

ALTER TABLE teams ADD COLUMN auto_join_domains text NOT NULL DEFAULT '[]';
ALTER TABLE teams ADD COLUMN auto_join_enabled integer NOT NULL DEFAULT 1;

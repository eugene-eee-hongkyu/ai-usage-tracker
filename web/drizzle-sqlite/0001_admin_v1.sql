-- admin-v1 (Phase 4.1): users 라이프사이클 + 권한 컬럼.
-- LOCAL_MODE (.dmg) 는 1인용이라 admin UI 자체가 hidden — 컬럼만 schema 일관성 위해 추가.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN suspended_at INTEGER;
ALTER TABLE users ADD COLUMN deleted_at INTEGER;

-- M6f (2026-05-25): user_snapshots / period_snapshots 에 token_id 컬럼 추가.
-- PG schema 와 sync 위해서만 — LOCAL_MODE 는 api_tokens 테이블 자체가 없어
-- (단일 user/단일 머신 환경) token_id 는 항상 NULL. dashboard 의 device chip
-- row 도 devices.length>=2 일 때만 표시되므로 LOCAL_MODE UI 변화 0.

ALTER TABLE user_snapshots ADD COLUMN token_id integer;
ALTER TABLE period_snapshots ADD COLUMN token_id integer;

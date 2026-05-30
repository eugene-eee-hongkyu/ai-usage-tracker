-- Phase 2 (2026-05-30): Codex plan tier — LOCAL_MODE 도 PG schema 와 동기화.
ALTER TABLE users ADD COLUMN codex_plan_tier text;

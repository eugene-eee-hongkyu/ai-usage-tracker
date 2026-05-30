-- Multi-provider plan tier (2026-05-30):
-- Codex (OpenAI) 의 plan tier 를 Claude 와 독립적으로 저장.
-- 옛 plan_tier 컬럼은 Claude Code 용으로 유지 (rename 안 함 — backwards compat).
-- 값: 'free' | 'plus' | 'business' | 'pro' | 'team' | 'enterprise' | 'api' | NULL
-- NULL 은 미입력 — UI 가 modal 강제로 입력 유도.

ALTER TABLE users ADD COLUMN codex_plan_tier text;

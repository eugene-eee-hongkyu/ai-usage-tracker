-- 2026-05-31 data-pipeline-slim-phase1c — api_tokens.scopes 컬럼 drop.
--
-- 배경: 권한 세분화 placeholder 였으나 코드 grep 0 건 (확인 완료, data-pipeline-analysis.md §3).
-- users.permissions jsonb 로 권한 모델 이전됨. fine-grained 토큰 scope 부활 가능성 낮음.
--
-- 가역: ADD COLUMN 으로 복원 가능 (어차피 미사용 dead column 이라 데이터 손실 의미 X).

ALTER TABLE api_tokens DROP COLUMN IF EXISTS scopes;

-- ─────────────────────────────────────────────────────────────────────
-- DOWN (수동 복원용)
-- ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE api_tokens ADD COLUMN scopes JSONB NOT NULL DEFAULT '[]'::jsonb;

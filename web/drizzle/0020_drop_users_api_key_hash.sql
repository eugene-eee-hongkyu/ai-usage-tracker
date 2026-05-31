-- 2026-05-31 data-pipeline-slim-phase2 — users.api_key_hash 컬럼 drop.
--
-- 배경: M6e (2026-05-21) 의 device-scope api_tokens.hash 모델로 인증 이전.
-- 1~2주 dual mode fallback 컬럼이었으나 prod 진단 결과 (data-pipeline-slim-phase2to4 run 단계 1)
-- fallback 분기 hit 0 확정:
--   - api_key_hash 잔존 4명 모두 api_tokens.hash = users.api_key_hash 동일 → 1차 매칭으로 통과
--   - api_key_hash null 5명 + 1명 (총 6명) 은 fallback 분기 진입 불가
--   - 모든 active token 최근 7일 안 사용 + CLI 0.2.0~0.3.2 분포 모두 api_tokens 매칭
-- ingest/auth/historical 3 route 의 fallback 분기 동시 제거 + schema.ts apiKeyHash 정의 제거.
--
-- 가역: ADD COLUMN 으로 복원 가능 (단 raw hash 값 복구 불가, 사용자별 재발급 필요).

ALTER TABLE users DROP COLUMN IF EXISTS api_key_hash;

-- ─────────────────────────────────────────────────────────────────────
-- DOWN (수동 복원용 — 컬럼은 복원되나 값은 복구 불가, 사용자별 api_tokens 재발급 필요)
-- ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE users ADD COLUMN api_key_hash TEXT;

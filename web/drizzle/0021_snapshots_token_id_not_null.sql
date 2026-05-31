-- 2026-05-31 M6f Phase 3 — user_snapshots / period_snapshots 의 token_id NOT NULL 강제.
--
-- 배경:
-- - M6f Phase 1 (2026-05-21): api_tokens device-scope 신설
-- - M6f Phase 2 (2026-05-26): user_snapshots / period_snapshots 에 token_id 추가
--   (legacy fallback row 안전망 위해 nullable 유지)
-- - data-pipeline-slim phase 2 (2026-05-31, commit 5cc2fe9): users.api_key_hash
--   fallback 분기 통째 제거 + 컬럼 drop → fallback path 사라짐
-- - 따라서 token_id 가 nullable 일 이유 없음. M6f Phase 3 의 본 단계.
--
-- 사전 검증 (data-pipeline-slim-phase2to4 run + 본 작업 시점):
-- - user_snapshots: 13 row, token_id NULL = 0 ✓
-- - period_snapshots: 109 row, token_id NULL = 0 ✓
-- - ingest route 의 fallback 분기 (matchedTokenId=null path) 제거 commit 5cc2fe9 후
--   신규 row 의 tokenId 는 항상 not null
--
-- 가역: ALTER COLUMN DROP NOT NULL 로 복원 가능 (NULL 데이터 없으니 의미는 자연 동일).

ALTER TABLE user_snapshots ALTER COLUMN token_id SET NOT NULL;
ALTER TABLE period_snapshots ALTER COLUMN token_id SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- DOWN (수동 복원용)
-- ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE user_snapshots ALTER COLUMN token_id DROP NOT NULL;
-- ALTER TABLE period_snapshots ALTER COLUMN token_id DROP NOT NULL;

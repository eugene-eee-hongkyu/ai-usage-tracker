-- Multi-provider ingest — mixed row 폐기 (2026-05-29).
--
-- 실행 시점: 영향 user 3명이 install repair 완료 + 새 schedule 1회 이상 작동 확인 후.
-- 정밀화: `provider='claude' AND ccusageDaily 안 non-Claude 모델 있음` 인 row 만 폐기.
-- → 새 codex row (provider='codex') 와 분리 호출 후 정확한 claude row 둘 다 안 건드림.
--
-- 영향 user (진단 결과 2026-05-29):
--   user_id=2 (oreo, jinwoo.park@z21labs.xyz): user_snapshots 58 mixed rows
--   user_id=4 (Youngjin Kim, youngjin.kim@z21labs.xyz): user_snapshots 39 mixed rows
--   user_id=9 (송화중, hwajoong@thenexa.io): user_snapshots 32 mixed rows
--
-- 폐기 후 historical.mjs 가 백그라운드 backfill (지난 8주 + 12개월) 으로 정확한
-- Claude / Codex 분리 데이터 회복. Phase 1 안에서 oreo 의 Gemini 데이터는 일시 사라짐
-- (Phase 2 multi-provider 확장 backlog).

BEGIN;

-- user_snapshots — provider='claude' 인 mixed row 만. 새 codex row 보존.
DELETE FROM user_snapshots
WHERE provider = 'claude'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(raw_json->'ccusageDaily'->'daily') AS daily_row,
         jsonb_array_elements_text(daily_row->'modelsUsed') AS model
    WHERE jsonb_typeof(raw_json->'ccusageDaily'->'daily') = 'array'
      AND jsonb_typeof(daily_row->'modelsUsed') = 'array'
      AND model NOT ILIKE 'claude%'
      AND model NOT ILIKE '%synthetic%'
  );

-- period_snapshots 동일 패턴 — historical snapshot 의 옛 mixed row.
DELETE FROM period_snapshots
WHERE provider = 'claude'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(raw_json->'ccusageDaily'->'daily') AS daily_row,
         jsonb_array_elements_text(daily_row->'modelsUsed') AS model
    WHERE jsonb_typeof(raw_json->'ccusageDaily'->'daily') = 'array'
      AND jsonb_typeof(daily_row->'modelsUsed') = 'array'
      AND model NOT ILIKE 'claude%'
      AND model NOT ILIKE '%synthetic%'
  );

-- user_blocks — provider='claude' 가드 + models 컬럼 직접 검사 (block 단위 정밀).
DELETE FROM user_blocks
WHERE provider = 'claude'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(models::jsonb) AS m
    WHERE m NOT ILIKE 'claude%' AND m NOT ILIKE '%synthetic%'
  );

COMMIT;

-- 검증 SQL (실행 후 spot check):
--   SELECT user_id, provider, COUNT(*)
--     FROM user_snapshots WHERE user_id IN (2,4,9) GROUP BY user_id, provider;
--   → provider='claude' 의 row 가 0 또는 새 분리 데이터 (Claude only) 만 남아있고,
--     provider='codex' 의 row 는 보존 (영향 user 가 Codex 사용자면 1+).
--
--   같은 패턴으로 period_snapshots, user_blocks 도 확인.

-- 2026-05-31 data-pipeline-slim-phase1c — raw_json.ccusageBlocks 잔존 키 제거.
--
-- 배경: phase1b 에서 CLI 송신 / 서버 ingest / user_blocks 테이블 모두 제거됨.
-- 단 기존 user_snapshots / period_snapshots row 의 raw_json 에는 ccusageBlocks 키가
-- 잔존. UI grep 0 건 (data-pipeline-analysis.md §3.2 확인) 이지만 jsonb 표면 cleanup
-- 가치 큼 (미래 grep / 마이그 / 분석 노이즈 제거).
--
-- 비가역: jsonb 키 삭제 후 복원 불가. 단 phase1b 에서 신규 row 안 들어오니 더 늘어나지
-- 않음. 옛 데이터도 어차피 dead 라 복원 의미 X.
--
-- dry-run 권장: 적용 전 영향 row 수 확인
--   SELECT COUNT(*) FROM user_snapshots WHERE raw_json ? 'ccusageBlocks';
--   SELECT COUNT(*) FROM period_snapshots WHERE raw_json ? 'ccusageBlocks';

BEGIN;

UPDATE user_snapshots
SET raw_json = raw_json - 'ccusageBlocks'
WHERE raw_json ? 'ccusageBlocks';

UPDATE period_snapshots
SET raw_json = raw_json - 'ccusageBlocks'
WHERE raw_json ? 'ccusageBlocks';

COMMIT;

-- 사후 확인:
--   SELECT COUNT(*) FROM user_snapshots WHERE raw_json ? 'ccusageBlocks'; -- 0
--   SELECT COUNT(*) FROM period_snapshots WHERE raw_json ? 'ccusageBlocks'; -- 0

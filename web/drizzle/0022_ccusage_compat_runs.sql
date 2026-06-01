-- 2026-06-01: ccusage / codeburn 핀 bump 전 호환 검증 도구 저장소 신설.
--
-- 배경:
-- - 5/31~6/1 ccusage 19.0.2 → 20.0.6 + codeburn 0.9.7 → 0.9.11 핀 bump 전
--   사용자 3명 머신 (eugene/oreo/Youngjin) 에서 raw 출력 캡처 비교.
-- - PoC 단계엔 결과를 api_tokens.metadata.lastCompatCheck 에 박았으나,
--   /api/ingest 가 metadata 컬럼 통째 REPLACE 하던 버그로 매 1시간 sync 후
--   증발. ingest 는 jsonb merge 로 fix 했고, 검증 도구 데이터는 prod 메타와
--   완전 분리 (영진님 지적).
-- - ccusage / codeburn 새 버전 나올 때마다 반복 검증 → history 누적 보관.
--
-- 가역: DROP TABLE 로 복원 (검증 history 손실).

CREATE TABLE ccusage_compat_runs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_id INTEGER NOT NULL REFERENCES api_tokens(id),
  ran_at TIMESTAMP NOT NULL DEFAULT NOW(),
  cli_version TEXT NOT NULL,
  os TEXT NOT NULL,
  ccusage_old_version TEXT NOT NULL,
  ccusage_new_version TEXT NOT NULL,
  codeburn_old_version TEXT NOT NULL,
  codeburn_new_version TEXT NOT NULL,
  -- ccusage + codeburn raw 묶음 (4 + 20 raw 캡처, 본인 추정 한 사용자 400KB).
  payload JSONB NOT NULL
);

CREATE INDEX ccusage_compat_runs_user_ran_idx
  ON ccusage_compat_runs (user_id, ran_at);

-- ─────────────────────────────────────────────────────────────────────
-- DOWN (수동 복원용)
-- ─────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS ccusage_compat_runs_user_ran_idx;
-- DROP TABLE IF EXISTS ccusage_compat_runs;

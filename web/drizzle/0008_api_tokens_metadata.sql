-- M6e (2026-05-21): api_tokens.metadata jsonb — device-scope 진단 정보.
-- CLI 가 envInfo (OS · arch · cliVersion · claudeCodeVersion · hookEnabled
-- · lastError · installMethod 등) 보내면 서버가 매 ingest 시 UPDATE.

ALTER TABLE api_tokens
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

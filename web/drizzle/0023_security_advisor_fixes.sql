-- 2026-06-12: Supabase Security Advisor 대응 — Critical 1건 + Warn 2건.
--
-- Critical (ERROR, rls_disabled_in_public):
--   ccusage_compat_runs 가 6/1 마이그 0022 에서 RLS 활성화 누락.
--   server-side (drizzle + DATABASE_URL) 는 Postgres direct connection 이라
--   RLS 무시하고 정상 동작했지만, Supabase PostgREST API (anon key) 표면으로
--   외부 SELECT/INSERT/DELETE 가능했음. 다른 11 테이블 (api_tokens / users /
--   teams 등) 처럼 RLS 켜고 policy 미작성 = 모든 anon/authenticated deny.
--   우리 server-side 만 통과.
--
-- Warn (WARN, function_search_path_mutable):
--   audit_chain_hash() 트리거 + verify_audit_chain(bigint) 모두 search_path
--   미명시. audit_logs (unqualified) 참조하므로 search_path = '' 면 깨짐.
--   public, pg_temp 로 명시 — Supabase 공식 best practice + audit_logs 접근 보장 +
--   임시 테이블 hijack 회피.
--
-- 가역: 모두 단순 DDL 토글 — DOWN 섹션 주석 참고.

-- ─────────────────────────────────────────────────────────────────────
-- 1) ccusage_compat_runs RLS 활성 (다른 테이블과 동일 패턴, policy 0개 유지)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE ccusage_compat_runs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 2) audit 함수 search_path 명시
-- ─────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.audit_chain_hash() SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_audit_chain(bigint) SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────
-- DOWN (수동 복원용)
-- ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE ccusage_compat_runs DISABLE ROW LEVEL SECURITY;
-- ALTER FUNCTION public.audit_chain_hash() RESET search_path;
-- ALTER FUNCTION public.verify_audit_chain(bigint) RESET search_path;

-- user_blocks RLS 활성화 (Supabase Security Advisor 경고 fix).
-- 0003 에서 테이블 만들 때 누락됐던 RLS enable. 다른 테이블 (user_snapshots,
-- period_snapshots, daily_visits) 과 동일 패턴 — policy 추가 없이 enable 만.
--
-- 웹 앱은 pg Pool (service_role) 로 접근하므로 RLS bypass — 영향 없음.
-- anon key REST API 접근만 차단 (= Security Advisor 가 가리키던 노출 경로).

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

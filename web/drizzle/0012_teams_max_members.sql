-- 2026-05-22: teams.max_members — 회사 (팀) 별 활성 멤버 수 cap.
-- auth.ts auto-join 분기 + /api/admin/invitations POST 에서 cap 체크.
-- Platform Admin 만 변경 가능 (PATCH /api/admin/teams/[id]).
-- 기본값 5 — 외부 회사 도입 초기 단계 라 작은 cap 으로 시작, 도입 진척에
-- 따라 회사별로 풀어준다.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 5;

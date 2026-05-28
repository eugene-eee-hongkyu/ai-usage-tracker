-- 2026-05-28 보안 감사 H1 (OAuth provider mismatch / account takeover) — temp Option A.
--
-- 문제:
--   signIn callback 이 기존 user 매칭을 email 단독으로 수행 → GitHub primary email
--   verification 미강제 + Google email 검증 의존 가정이 깨지는 케이스에서 한 OAuth
--   provider 의 unverified primary email 로 다른 provider 가입자의 행 탈취 가능.
--   (state.md H1 우선순위 — Platform Admin 행이면 view-as / 새 팀 생성 권한이 넘어감.)
--
-- 임시 가드 (옵션 A):
--   users.provider 컬럼 추가 (text, nullable). signIn callback 에서 기존 user 매칭
--   시 다음 분기:
--     - users.provider == null  : legacy 사용자 → 현재 OAuth provider 로 backfill 후 통과.
--     - users.provider == 현재 provider : 통과.
--     - users.provider != 현재 provider : reject (`/login?error=provider_mismatch`).
--
--   신규 사용자 INSERT 시 provider 컬럼 같이 박음.
--
-- Phase 4.2 옵션 B (1-2주):
--   표준 oauth_accounts 테이블 도입 + 한 사용자가 여러 provider 명시 link 가능. 그
--   단계까지 이 가드가 유효.
--
-- 운영 영향:
--   기존 사용자 첫 로그인 시 자동 backfill — 사용자 인지 X. 두 번째 provider 시도하면
--   /login 화면에 명시 에러. UI 메시지 추가는 별도 PR (이 마이그는 schema only).

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS provider text;

-- 컬럼 추가만. backfill 은 signIn callback 의 lazy 경로가 처리 — 사용자가
-- 다음 로그인 시 자동으로 provider 채워짐. 그 사이 시점에 다른 provider 로 들어와도
-- null 이라 통과 (legacy 호환). signIn 첫 통과 후엔 영구 lock.

COMMIT;

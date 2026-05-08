-- P7 — snapshot 있음 / overview 없음 (sync needed). C-1 §2 P7.
-- /dashboard 진입 시 "sync needed" 박스 + 복사 버튼 노출.

TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

INSERT INTO users (id, github_id, email, name, timezone, api_key_hash, last_synced_at)
VALUES (
  11,
  'gh-p7-bob',
  'bob@iskra.world',
  'Bob',
  'Asia/Singapore',
  'sha256:0000000000000000000000000000000000000000000000000000000000000007',
  NOW() - INTERVAL '5 minutes'
);

-- user_snapshots row 미시드 → /api/dashboard 코드의 `if (!snap[0])` 분기 진입
-- → 응답 overview=null → DashboardView 가 sync-needed UI 렌더 (코드 line 196).
-- (C-1 §2 의 raw_json 모든 period null 정의는 라이브 환경에서 자연 발생하는 패턴이지만
-- 실제 코드는 user_snapshots row 없을 때만 overview=null 반환.)

SELECT setval('users_id_seq', 100);

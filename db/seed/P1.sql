-- P1 — 신규 (DB rows=0). C-1 §2 P1.
-- 모든 페르소나 시드 전 baseline 으로도 사용.
TRUNCATE users, user_snapshots, period_snapshots, daily_visits RESTART IDENTITY CASCADE;

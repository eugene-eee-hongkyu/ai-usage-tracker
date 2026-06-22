-- 2026-06-22: cli-compat-check cron 메일 중복 발송 방지.
--
-- 문제: cron 이 매일 (핀 from → npm latest to) 비교 후 다르면 메일을 보내는데,
--   핀이 고정이라 latest 가 한 번 오르면 사람이 핀 bump 할 때까지 매일 같은 조합으로
--   메일이 반복됐다. (예: latest 가 23일 1.1 → 30일 1.2 일 때, 23~30일 매일 발송)
-- 해결: (pkg, from, to) 조합별 발송 이력을 기록. cron 은 이미 보낸 조합이면 skip →
--   버전 전환 시 1회만 발송 (23일 1회, 30일 1회).
--
-- RLS: 다른 테이블과 동일 패턴 (0023 Security Advisor 대응) — ENABLE 만, policy 0개.
--   server-side (drizzle + DATABASE_URL, BYPASSRLS) 만 통과, PostgREST anon 표면 차단.
--
-- 가역: DOWN 섹션 주석 참고.

CREATE TABLE IF NOT EXISTS "cli_compat_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "pkg" text NOT NULL,
  "from_version" text NOT NULL,
  "to_version" text NOT NULL,
  "verdict" text NOT NULL,
  "emailed_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "cli_compat_notifications_pkg_from_to_idx"
  ON "cli_compat_notifications" ("pkg", "from_version", "to_version");

ALTER TABLE "cli_compat_notifications" ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- DOWN (수동 복원용)
-- ─────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS "cli_compat_notifications";

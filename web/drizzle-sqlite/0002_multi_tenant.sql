-- ============================================================================
-- Phase 4.2 M6a (SQLite) — multi-tenant 도입
-- ============================================================================
--
-- LOCAL_MODE 의 SQLite 가 PG 의 0005_multi_tenant 와 동등하도록 적용.
-- SQLite 에 존재하는 데이터 테이블만 처리:
--   - user_snapshots / period_snapshots / user_blocks / daily_visits (4)
-- invitations / join_requests / api_tokens / audit_logs 는 SQLite 에 없음 (cloud
-- 전용) — schema-sqlite.ts 의 주석 참조.
--
-- single-user 가정 — team "Local" (id=1) 1개. 모든 기존 row team_id=1 backfill.
--
-- 적용 순서:
--   1) CREATE teams + team_members
--   2) INSERT 기본 팀 (Local, owner_id=1) + team_members backfill
--   3) ALTER ADD COLUMN team_id NOT NULL DEFAULT 1 (SQLite 는 DEFAULT 있으면 backfill 자동)
--   4) DROP 옛 unique + CREATE team-scoped unique
--   5) team_id 보조 인덱스

-- ----------------------------------------------------------------------------
-- 1) teams + team_members 신설
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`owner_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `teams_slug_uniq` ON `teams` (`slug`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teams_owner_idx` ON `teams` (`owner_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `team_members_team_user_uniq` ON `team_members` (`team_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `team_members_user_idx` ON `team_members` (`user_id`);
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 2) backfill — Local 팀 + 기존 user 멤버십
-- ----------------------------------------------------------------------------
INSERT OR IGNORE INTO `teams` (`id`, `name`, `slug`, `owner_id`) VALUES (1, 'Local', 'local', 1);
--> statement-breakpoint

INSERT OR IGNORE INTO `team_members` (`team_id`, `user_id`, `role`)
SELECT 1, id, 'owner' FROM users WHERE deleted_at IS NULL;
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 3) 4 데이터 테이블에 team_id NOT NULL DEFAULT 1 추가
--    SQLite 의 ALTER ADD COLUMN 은 DEFAULT 가 있으면 기존 row 에 자동 backfill.
-- ----------------------------------------------------------------------------
ALTER TABLE `user_snapshots`    ADD COLUMN `team_id` integer NOT NULL DEFAULT 1 REFERENCES `teams`(`id`);
--> statement-breakpoint
ALTER TABLE `period_snapshots`  ADD COLUMN `team_id` integer NOT NULL DEFAULT 1 REFERENCES `teams`(`id`);
--> statement-breakpoint
ALTER TABLE `user_blocks`       ADD COLUMN `team_id` integer NOT NULL DEFAULT 1 REFERENCES `teams`(`id`);
--> statement-breakpoint
ALTER TABLE `daily_visits`      ADD COLUMN `team_id` integer NOT NULL DEFAULT 1 REFERENCES `teams`(`id`);
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 4) 옛 unique → team-scoped unique
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS `user_snapshots_user_uniq`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_snapshots_user_team_uniq` ON `user_snapshots` (`user_id`,`team_id`);
--> statement-breakpoint

DROP INDEX IF EXISTS `period_snapshots_uniq`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `period_snapshots_uniq` ON `period_snapshots` (`user_id`,`team_id`,`period_type`,`period_start`);
--> statement-breakpoint

DROP INDEX IF EXISTS `user_blocks_user_block_uniq`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_blocks_user_team_block_uniq` ON `user_blocks` (`user_id`,`team_id`,`block_id`);
--> statement-breakpoint

DROP INDEX IF EXISTS `daily_visits_user_date_uniq`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `daily_visits_user_team_date_uniq` ON `daily_visits` (`user_id`,`team_id`,`date`);
--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 5) team_id 보조 인덱스
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `user_snapshots_team_idx`    ON `user_snapshots` (`team_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `period_snapshots_team_idx`  ON `period_snapshots` (`team_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_blocks_team_idx`       ON `user_blocks` (`team_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `daily_visits_team_idx`      ON `daily_visits` (`team_id`);

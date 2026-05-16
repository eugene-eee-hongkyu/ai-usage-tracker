CREATE TABLE `daily_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`total_dwell_seconds` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_visits_user_date_uniq` ON `daily_visits` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `period_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`period_type` text NOT NULL,
	`period_start` text NOT NULL,
	`captured_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`raw_json` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `period_snapshots_uniq` ON `period_snapshots` (`user_id`,`period_type`,`period_start`);--> statement-breakpoint
CREATE TABLE `user_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`block_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`minutes` integer NOT NULL,
	`entries` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`models` text DEFAULT '[]' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_blocks_user_block_uniq` ON `user_blocks` (`user_id`,`block_id`);--> statement-breakpoint
CREATE INDEX `user_blocks_user_started_idx` ON `user_blocks` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `user_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`raw_json` text NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`sessions_count` integer DEFAULT 0 NOT NULL,
	`calls_count` integer DEFAULT 0 NOT NULL,
	`cache_hit_pct` real DEFAULT 0 NOT NULL,
	`overall_one_shot` real DEFAULT 0 NOT NULL,
	`current_week_raw_json` text,
	`current_week_start` text,
	`current_month_raw_json` text,
	`current_month_start` text,
	`current_day_raw_json` text,
	`current_day_start` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_snapshots_user_uniq` ON `user_snapshots` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`github_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`api_key_hash` text,
	`timezone` text,
	`plan_tier` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_synced_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
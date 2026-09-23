CREATE TABLE `analytics_event` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`path` text,
	`referrer` text,
	`session_id` text,
	`user_id` text,
	`props` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_created_idx` ON `analytics_event` (`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_type_idx` ON `analytics_event` (`type`);--> statement-breakpoint
CREATE TABLE `user_preference` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_pref_unique` ON `user_preference` (`user_id`,`kind`,`key`);--> statement-breakpoint
CREATE INDEX `user_pref_user_idx` ON `user_preference` (`user_id`);
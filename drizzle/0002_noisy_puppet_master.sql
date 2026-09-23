CREATE TABLE `comment_like` (
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_like_unique` ON `comment_like` (`user_id`,`comment_id`);--> statement-breakpoint
ALTER TABLE `comment` ADD `parent_id` text;--> statement-breakpoint
CREATE INDEX `comment_parent_idx` ON `comment` (`parent_id`);
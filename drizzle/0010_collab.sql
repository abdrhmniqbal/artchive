CREATE TABLE `collection_collaborator` (
	`collection_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collab_collection_idx` ON `collection_collaborator` (`collection_id`);--> statement-breakpoint
CREATE INDEX `collab_user_idx` ON `collection_collaborator` (`user_id`);
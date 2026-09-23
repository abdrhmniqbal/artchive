ALTER TABLE `pin` ADD `is_nsfw` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `show_nsfw` integer DEFAULT false NOT NULL;
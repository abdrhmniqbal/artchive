CREATE TABLE `report` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE NO ACTION ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `report_status_idx` ON `report` (`status`);
--> statement-breakpoint
CREATE INDEX `report_target_idx` ON `report` (`target_type`,`target_id`);

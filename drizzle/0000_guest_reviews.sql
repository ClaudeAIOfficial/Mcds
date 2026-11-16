CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` text,
	`rating` integer NOT NULL,
	`review_text` text NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	CONSTRAINT "rating_range" CHECK("reviews"."rating" between 1 and 5),
	CONSTRAINT "review_length" CHECK(length("reviews"."review_text") between 1 and 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_submission_id_unique` ON `reviews` (`submission_id`);
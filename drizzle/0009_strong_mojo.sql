CREATE INDEX IF NOT EXISTS "monument_athlete_year_idx" ON "monument_records" ("athlete_id","year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monument_year_pr_idx" ON "monument_records" ("is_year_pr");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monument_all_time_pr_idx" ON "monument_records" ("is_all_time_pr");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monument_distance_idx" ON "monument_records" ("distance");
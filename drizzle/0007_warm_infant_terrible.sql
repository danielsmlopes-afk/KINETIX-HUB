CREATE TABLE IF NOT EXISTS "monument_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid,
	"year" integer NOT NULL,
	"event_name" text NOT NULL,
	"distance" text NOT NULL,
	"official_time" text NOT NULL,
	"pace" text NOT NULL,
	"weather" text,
	"polyline" text,
	"is_all_time_pr" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "weather" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monument_records" ADD CONSTRAINT "monument_records_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

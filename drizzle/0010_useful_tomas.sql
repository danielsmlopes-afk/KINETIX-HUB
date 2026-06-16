CREATE TABLE IF NOT EXISTS "health_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"steps" integer DEFAULT 0,
	"sleep_hours" double precision DEFAULT 0,
	"hrv" double precision DEFAULT 0,
	"resting_heart_rate" double precision DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_configs" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monument_records" ADD COLUMN "activity_type" text DEFAULT 'Run';--> statement-breakpoint
ALTER TABLE "monument_records" ADD COLUMN "map_image_url" text;--> statement-breakpoint
ALTER TABLE "monument_records" ADD COLUMN "location_city" text;--> statement-breakpoint
ALTER TABLE "monument_records" ADD COLUMN "temperature" double precision;--> statement-breakpoint
ALTER TABLE "monument_records" ADD COLUMN "date" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "health_logs" ADD CONSTRAINT "health_logs_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

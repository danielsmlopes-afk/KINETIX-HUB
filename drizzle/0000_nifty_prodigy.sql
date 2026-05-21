CREATE TABLE IF NOT EXISTS "athletes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bioimpedance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid,
	"weight_kg" double precision NOT NULL,
	"body_fat_percentage" double precision NOT NULL,
	"bmr" double precision NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consumables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"alert_threshold" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "races" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"date" timestamp NOT NULL,
	"distance" double precision NOT NULL,
	"start_time" text NOT NULL,
	"start_location" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strava_gear_id" text NOT NULL,
	"name" text NOT NULL,
	"mileage" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "treadmill_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"distance_meters" double precision NOT NULL,
	"speed_kmh" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid,
	"date" timestamp NOT NULL,
	"duration_minutes" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bioimpedance_logs" ADD CONSTRAINT "bioimpedance_logs_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "treadmill_intervals" ADD CONSTRAINT "treadmill_intervals_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

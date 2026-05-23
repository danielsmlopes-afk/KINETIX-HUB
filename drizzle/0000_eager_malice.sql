CREATE TABLE IF NOT EXISTS "athletes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"strava_access_token" text,
	"strava_refresh_token" text,
	"strava_expires_at" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bioimpedance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid,
	"date" timestamp NOT NULL,
	"weight" double precision NOT NULL,
	"body_fat" double precision NOT NULL,
	"muscle_mass" double precision NOT NULL,
	"body_water" double precision NOT NULL,
	"visceral_fat" double precision NOT NULL,
	"metabolic_age" integer NOT NULL,
	"tmb" double precision NOT NULL,
	"protein" double precision NOT NULL,
	"bone_mass" double precision NOT NULL,
	"health_notes" text
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
CREATE TABLE IF NOT EXISTS "cron_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercise_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"muscle_group" text NOT NULL,
	"equipment_type" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"workout_id" uuid NOT NULL,
	"action" text NOT NULL,
	"new_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "planned_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"activity_type" text NOT NULL,
	"title" text NOT NULL,
	"details" jsonb,
	"is_imported" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "races" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"date" timestamp NOT NULL,
	"distance" double precision NOT NULL,
	"start_time" text NOT NULL,
	"start_location" text NOT NULL,
	"name" text,
	"polyline" text,
	"moving_time" integer,
	"weather" text,
	"is_target" boolean DEFAULT false,
	"target_pace" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strava_gear_id" text NOT NULL,
	"name" text NOT NULL,
	"mileage" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strength_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"actual_sets" integer NOT NULL,
	"actual_reps" text NOT NULL,
	"weight_used" double precision,
	"notes" text
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
	"duration_minutes" integer NOT NULL,
	"load" double precision,
	"distance" double precision,
	"gear_id" text,
	"average_heartrate" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workout_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sets" integer NOT NULL,
	"reps" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "workout_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bioimpedance_logs" ADD CONSTRAINT "bioimpedance_logs_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "planned_workouts" ADD CONSTRAINT "planned_workouts_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_logs" ADD CONSTRAINT "strength_logs_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_logs" ADD CONSTRAINT "strength_logs_exercise_id_exercise_library_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "exercise_library"("id") ON DELETE restrict ON UPDATE no action;
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_template_items" ADD CONSTRAINT "workout_template_items_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_template_items" ADD CONSTRAINT "workout_template_items_exercise_id_exercise_library_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "exercise_library"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "planned_workouts" ADD COLUMN "warmup" text;--> statement-breakpoint
ALTER TABLE "planned_workouts" ADD COLUMN "cooldown" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "warmup" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "cooldown" text;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "warmup" text;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "cooldown" text;
ALTER TABLE "athletes" ADD COLUMN "home_lat" double precision;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "home_lon" double precision;--> statement-breakpoint
ALTER TABLE "planned_workouts" ADD COLUMN "rest_details" text;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "priority" text;
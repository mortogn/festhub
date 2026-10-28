CREATE TYPE "contest_kind" AS ENUM('official', 'problem_set');--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "kind" "contest_kind" DEFAULT 'official'::"contest_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ALTER COLUMN "starts_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ALTER COLUMN "ends_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "contests_kind_is_active_index" ON "contests" ("kind","is_active");--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_official_event_check" CHECK ("kind" <> 'official' OR "event_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_official_schedule_check" CHECK ("kind" <> 'official' OR ("starts_at" IS NOT NULL AND "ends_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_problem_set_shape_check" CHECK ("kind" <> 'problem_set' OR ("event_id" IS NULL AND "starts_at" IS NULL AND "ends_at" IS NULL));
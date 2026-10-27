CREATE TYPE "submission_verdict" AS ENUM('AC', 'WA', 'CE', 'RE', 'TLE', 'MLE');--> statement-breakpoint
CREATE TABLE "contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"event_id" uuid NOT NULL UNIQUE,
	"allowedLanguages" integer[],
	"is_active" boolean DEFAULT false NOT NULL,
	"password" text
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"memory_limit_in_kilobytes" integer DEFAULT 131072 NOT NULL,
	"cpu_limit_in_seconds" integer DEFAULT 2 NOT NULL,
	"contest_id" uuid NOT NULL,
	CONSTRAINT "problems_contest_id_position_unique" UNIQUE("contest_id","position")
);
--> statement-breakpoint
CREATE TABLE "submission_test_case_results" (
	"submission_id" uuid NOT NULL,
	"test_case_id" uuid NOT NULL,
	"judge0Token" text,
	"execution_time" real,
	"memory_used" integer,
	"verdict" "submission_verdict",
	"compile_output" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	CONSTRAINT "submission_test_case_results_submission_id_test_case_id_unique" UNIQUE("submission_id","test_case_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"problem_id" uuid NOT NULL,
	"source_code" text NOT NULL,
	"language_code" integer NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verdict" "submission_verdict",
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"submitted_by_user_id" uuid NOT NULL,
	"team_id" uuid
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"problem_id" uuid NOT NULL,
	"stdin" text NOT NULL,
	"stdout" text NOT NULL,
	"position" integer NOT NULL,
	"is_sample" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "test_cases_problem_id_position_unique" UNIQUE("problem_id","position")
);
--> statement-breakpoint
CREATE INDEX "submissions_status_index" ON "submissions" ("status");--> statement-breakpoint
CREATE INDEX "submissions_problem_id_submitted_at_index" ON "submissions" ("problem_id","submitted_at");--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id");--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_contest_id_contests_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id");--> statement-breakpoint
ALTER TABLE "submission_test_case_results" ADD CONSTRAINT "submission_test_case_results_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id");--> statement-breakpoint
ALTER TABLE "submission_test_case_results" ADD CONSTRAINT "submission_test_case_results_test_case_id_test_cases_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_problems_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitted_by_user_id_users_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_problem_id_problems_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id");
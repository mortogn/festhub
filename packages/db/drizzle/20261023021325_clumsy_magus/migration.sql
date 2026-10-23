CREATE TABLE "students" (
	"user_id" uuid PRIMARY KEY,
	"student_id" text NOT NULL UNIQUE,
	"batch" text NOT NULL,
	"department" text NOT NULL,
	"is_hsc" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"user_id" uuid PRIMARY KEY,
	"teacher_id" text NOT NULL UNIQUE,
	"department" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"display_image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"max_participants" integer,
	"volunteer_registration" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"volunteer_starts_at" timestamp with time zone,
	"volunteer_ends_at" timestamp with time zone,
	"max_volunteers" integer,
	"is_active" boolean DEFAULT false NOT NULL,
	"venue_id" uuid,
	"team_based" boolean DEFAULT false NOT NULL,
	"max_team_size" integer,
	"min_team_size" integer,
	"max_teams" integer,
	"thumbnail" text,
	"banner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"team_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text,
	"invited_at" timestamp with time zone DEFAULT now(),
	"accepted_at" timestamp with time zone,
	CONSTRAINT "team_invitations_team_id_student_id_unique" UNIQUE("team_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"leader_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text,
	"registered_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "teams_event_id_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"student_id" uuid,
	"event_id" uuid,
	"checked_in_at" timestamp with time zone,
	"team_id" uuid,
	"registered_at" timestamp with time zone DEFAULT now(),
	"registration_status" text DEFAULT 'pending' NOT NULL,
	"registration_accepted_at" timestamp with time zone,
	CONSTRAINT "participants_pkey" PRIMARY KEY("student_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"student_id" uuid,
	"event_id" uuid,
	"checked_in_at" timestamp with time zone,
	"checked_out_at" timestamp with time zone,
	"assigned_at" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"registration_status" text,
	"invite_status" text,
	"invitation_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"invited_by_id" uuid,
	CONSTRAINT "volunteers_pkey" PRIMARY KEY("student_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"capacity" integer NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizers" (
	"teacher_id" uuid,
	"event_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now(),
	"assigned_by_id" uuid,
	CONSTRAINT "organizers_pkey" PRIMARY KEY("teacher_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "refresh-tokens" (
	"jid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"family_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher-invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL UNIQUE,
	"invited_at" timestamp with time zone DEFAULT now(),
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id");--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_student_id_students_user_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("user_id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_students_user_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "students"("user_id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id");--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_student_id_students_user_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("user_id");--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id");--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_student_id_students_user_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("user_id");--> statement-breakpoint
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id");--> statement-breakpoint
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_invited_by_id_users_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_teacher_id_teachers_user_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("user_id");--> statement-breakpoint
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id");--> statement-breakpoint
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_assigned_by_id_users_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "refresh-tokens" ADD CONSTRAINT "refresh-tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "students" ADD COLUMN "qr_token" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "attendance_qr_token" uuid;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "checked_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_qr_token_key" UNIQUE("qr_token");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_attendance_qr_token_key" UNIQUE("attendance_qr_token");
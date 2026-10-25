CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY,
	"temporary_key" text NOT NULL,
	"key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"owner_id" uuid NOT NULL,
	"type" text NOT NULL,
	"resource_id" uuid,
	"content_type" text,
	"file_size" integer NOT NULL,
	"actual_size" integer
);
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "display_image" TO "display_image_id";--> statement-breakpoint
ALTER TABLE "events" RENAME COLUMN "thumbnail" TO "thumbnail_id";--> statement-breakpoint
ALTER TABLE "events" RENAME COLUMN "banner" TO "banner_id";--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "thumbnail_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "display_image_id" SET DATA TYPE uuid USING "display_image_id"::uuid;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "thumbnail_id" SET DATA TYPE uuid USING "thumbnail_id"::uuid;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "banner_id" SET DATA TYPE uuid USING "banner_id"::uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_display_image_id_uploads_id_fkey" FOREIGN KEY ("display_image_id") REFERENCES "uploads"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_thumbnail_id_uploads_id_fkey" FOREIGN KEY ("thumbnail_id") REFERENCES "uploads"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_banner_id_uploads_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "uploads"("id");--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_thumbnail_id_uploads_id_fkey" FOREIGN KEY ("thumbnail_id") REFERENCES "uploads"("id");--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const uploadsTable = pgTable("uploads", {
  id: uuid().primaryKey(),

  temporaryKey: text("temporary_key").notNull(),
  key: text("key").notNull(),

  status: text("status", { enum: ["pending", "rejected", "accepted"] })
    .notNull()
    .default("pending"),

  expiresAt: timestamp("expires_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),

  ownerId: uuid("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),

  type: text("type", {
    enum: ["avatar", "event_thumbnail", "event_banner", "venue_thumbnail"],
  }).notNull(),
  resourceId: uuid("resource_id"),

  contentType: text("content_type"),
  expectedSize: integer("file_size").notNull(),
  actualSize: integer("actual_size"),
});

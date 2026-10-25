import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uploadsTable } from "./uploads.js";

export const venuesTable = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  capacity: integer("capacity").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["LAB", "seminar", "classroom", "auditorium"],
  }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),

  thumbnailId: uuid("thumbnail_id").references(() => uploadsTable.id),
});

export type VenueSelect = typeof venuesTable.$inferSelect;

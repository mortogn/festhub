import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { teachersTable } from "./users.js";
import { eventsTable } from "./events.js";

export const organizersTable = pgTable(
  "organizers",
  {
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachersTable.userId),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id),

    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teacherId, table.eventId] })],
);

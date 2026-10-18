import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { teachersTable, usersTable } from "./users.js";
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
    assignedById: uuid("assigned_by_id").references(() => usersTable.id),
  },
  (table) => [primaryKey({ columns: [table.teacherId, table.eventId] })],
);

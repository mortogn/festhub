import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events.js";
import { studentsTable } from "./users.js";
import { teamsTable } from "./teams.js";

export const participantsTable = pgTable(
  "participants",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentsTable.userId),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id),

    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),

    teamId: uuid("team_id").references(() => teamsTable.id),

    registeredAt: timestamp("registered_at", {
      withTimezone: true,
    }).defaultNow(),
    registrationStatus: text("registration_status", {
      enum: ["pending", "accepted", "rejected"],
    })
      .notNull()
      .default("pending"),

    registrationAcceptedAt: timestamp("registration_accepted_at", {
      withTimezone: true,
    }),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.eventId] })],
);

import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { studentsTable } from "./users.js";
import { eventsTable } from "./events.js";

export const volunteersTable = pgTable(
  "volunteers",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentsTable.userId),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id),

    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),

    assignedAt: timestamp("assigned_at", { withTimezone: true }),

    registeredAt: timestamp("registered_at", { withTimezone: true }),
    registrationStatus: text("registration_status", {
      enum: ["pending", "approved", "rejected"],
    }),

    inviteStatus: text("invite_status", {
      enum: ["pending", "accepted", "rejected"],
    }),
    invitationSentAt: timestamp("invitation_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.eventId] })],
);

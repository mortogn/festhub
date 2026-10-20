import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { studentsTable } from "./users.js";
import { eventsTable } from "./events.js";

export const teamsTable = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leaderId: uuid("leader_id")
      .notNull()
      .references(() => studentsTable.userId),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id),

    name: text("name").notNull(),
    status: text("status", { enum: ["accepted", "pending", "rejected"] }),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.eventId, table.name)],
);

export const teamInvitationsTable = pgTable(
  "team_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teamsTable.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentsTable.userId),

    status: text("status", { enum: ["accepted", "pending", "rejected"] }),

    invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.teamId, table.studentId)],
);

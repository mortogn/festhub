import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const teacherInvitesTable = pgTable("teacher-invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

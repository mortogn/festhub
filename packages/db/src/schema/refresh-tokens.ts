import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const refreshTokensTable = pgTable("refresh-tokens", {
  jid: uuid("jid").primaryKey().defaultRandom(),
  familyId: uuid("family_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

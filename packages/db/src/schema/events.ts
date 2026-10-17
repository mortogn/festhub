import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { venuesTable } from "./venues.js";

export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["workshop", "seminar", "contest"] }).notNull(),
  maxParticipants: integer("max_participants"),
  volunteerRegistration: text("volunteer_registration", {
    enum: ["open", "closed"],
  }),

  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

  registrationOpensAt: timestamp("registration_opens_at", {
    withTimezone: true,
  }),
  registrationClosesAt: timestamp("registration_closes_at", {
    withTimezone: true,
  }),

  volunteerStartsAt: timestamp("volunteer_starts_at", {
    withTimezone: true,
  }),
  volunteerEndsAt: timestamp("volunteer_ends_at", {
    withTimezone: true,
  }),
  maxVolunteers: integer("max_volunteers"),
  isActive: boolean("is_active").notNull().default(false),

  venueId: uuid("venue_id").references(() => venuesTable.id),

  teamBased: boolean("team_based").notNull().default(false),
  maxTeamSize: integer("max_team_size"),
  minTeamSize: integer("min_team_size"),
  maxTeams: integer("max_teams"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export type EventSelect = typeof eventsTable.$inferSelect;

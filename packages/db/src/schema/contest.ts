import {
  boolean,
  integer,
  index,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events.js";
import { usersTable } from "./users.js";
import { teamsTable } from "./teams.js";

export const submissionVerdict = pgEnum("submission_verdict", [
  "AC",
  "WA",
  "CE",
  "RE",
  "TLE",
  "MLE",
]);

export const contestsTable = pgTable("contests", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().unique().notNull(),
  title: text().notNull(),
  description: text(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => eventsTable.id)
    .unique(),

  allowedLanguages: integer().array(),
  isActive: boolean("is_active").notNull().default(false),
  password: text("password"),
});

export const problemsTable = pgTable(
  "problems",
  {
    id: uuid().primaryKey().defaultRandom(),
    position: integer().notNull(),
    title: text().notNull(),
    statement: text().notNull(),
    memoryLimitInKilobytes: integer("memory_limit_in_kilobytes")
      .notNull()
      .default(1024 * 128),
    cpuLimitInSeconds: integer("cpu_limit_in_seconds").notNull().default(2),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contestsTable.id),
  },
  (table) => [unique().on(table.contestId, table.position)],
);

export const testCasesTable = pgTable(
  "test_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => problemsTable.id),
    stdin: text().notNull(),
    stdout: text().notNull(),
    position: integer().notNull(),
    isSample: boolean("is_sample").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.problemId, table.position)],
);

export const submissionsTable = pgTable(
  "submissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => problemsTable.id),
    sourceCode: text("source_code").notNull(),
    languageCode: integer("language_code").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    verdict: submissionVerdict(),
    status: text("status", {
      enum: ["queued", "processing", "completed", "error"],
    })
      .notNull()
      .default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorMessage: text("error_message"),

    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => usersTable.id),

    teamId: uuid("team_id").references(() => teamsTable.id),
  },
  (table) => [
    index().on(table.status),
    index().on(table.problemId, table.submittedAt),
  ],
);

export const submissionTestCaseResultsTable = pgTable(
  "submission_test_case_results",
  {
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissionsTable.id),

    testCaseId: uuid("test_case_id")
      .notNull()
      .references(() => testCasesTable.id),

    judge0Token: text(),

    executionTime: real("execution_time"),
    memoryUsed: integer("memory_used"),

    verdict: submissionVerdict(),
    compileOutput: text("compile_output"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.submissionId, table.testCaseId)],
);

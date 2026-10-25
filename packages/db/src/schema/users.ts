import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { uploadsTable } from "./uploads.js";

export const usersTable = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["student", "teacher", "admin"] }).notNull(),
  displayImageId: uuid("display_image_id").references(
    (): AnyPgColumn => uploadsTable.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const studentsTable = pgTable("students", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id),
  studentId: text("student_id").notNull().unique(),
  batch: text("batch").notNull(),
  department: text("department").notNull(),
  is_hsc: boolean("is_hsc").notNull().default(false),
});

export const teachersTable = pgTable("teachers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id),
  teacherId: text("teacher_id").notNull().unique(),
  department: text("department").notNull(),
});

export type UserSelect = typeof usersTable.$inferSelect;
export type TeacherSelect = typeof teachersTable.$inferSelect;
export type StudentSelect = typeof studentsTable.$inferSelect;

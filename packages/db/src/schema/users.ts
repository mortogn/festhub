import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["student", "teacher", "admin"] }).notNull(),
  displayImage: text("display_image"),
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
  studentId: integer("student_id").notNull().unique(),
  batch: integer("batch").notNull(),
  department: text("department").notNull(),
  is_hsc: boolean("is_hsc").notNull().default(false),
});

export const teachersTable = pgTable("teachers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id),
  teacherId: integer("teacher_id").notNull().unique(),
  department: text("department").notNull(),
});

import { Hono } from "hono";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { studentsTable, usersTable } from "@festhub/db/schema";
import { db } from "@festhub/db";
import { eq } from "drizzle-orm";

const app = new Hono().get(
  "/",
  enforceAuthMiddleware(["admin", "teacher"]),
  async (c) => {
    const students = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        department: studentsTable.department,
        batch: studentsTable.batch,
        studentId: studentsTable.studentId,
        displayImage: usersTable.displayImage,
        email: usersTable.email,
      })
      .from(studentsTable)
      .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id));

    return c.json(students);
  },
);

export default app;

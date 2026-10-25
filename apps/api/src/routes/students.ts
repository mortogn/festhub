import { Hono } from "hono";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import {
  eventsTable,
  participantsTable,
  studentsTable,
  usersTable,
  volunteersTable,
} from "@festhub/db/schema";
import { db } from "@festhub/db";
import { eq, or } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { ForbiddenException } from "../exceptions/forbidden-exception.js";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { alias } from "drizzle-orm/pg-core";
import { BadRequestException } from "../exceptions/bad-request-exception.js";

const app = new Hono()
  .get("/", enforceAuthMiddleware(["admin", "teacher"]), async (c) => {
    const students = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        department: studentsTable.department,
        batch: studentsTable.batch,
        studentId: studentsTable.studentId,
        displayImageId: usersTable.displayImageId,
        email: usersTable.email,
      })
      .from(studentsTable)
      .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id));

    return c.json(students);
  })
  .get(
    "/:id",
    enforceAuthMiddleware(),
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const user = c.var.user;
      const { id } = c.req.valid("param");

      if (!["teacher", "admin"].includes(user.role) && user.id !== id)
        throw new ForbiddenException();

      const isUUID = z.uuid().safeParse(id).success;

      const [studentRow] = await db
        .select({
          student: studentsTable,
          user: usersTable,
        })
        .from(studentsTable)
        .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
        .where(
          isUUID
            ? eq(studentsTable.userId, id)
            : eq(studentsTable.studentId, id),
        );

      if (!studentRow) throw new BadRequestException("Student not found");

      const participantsRows = await db
        .select()
        .from(participantsTable)
        .innerJoin(eventsTable, eq(eventsTable.id, participantsTable.eventId))
        .where(eq(participantsTable.studentId, studentRow.student.userId));

      const volunteersRows = await db
        .select()
        .from(volunteersTable)
        .innerJoin(eventsTable, eq(eventsTable.id, volunteersTable.eventId))
        .where(eq(volunteersTable.studentId, studentRow.student.userId));

      const result = {
        id: studentRow.user.id,
        name: studentRow.user.name,
        displayImageId: studentRow.user.displayImageId,
        email: studentRow.user.email,
        studentId: studentRow.student.studentId,
        department: studentRow.student.department,
        batch: studentRow.student.batch,
        events: participantsRows.flatMap(({ events, participants }) =>
          events && participants
            ? [
                {
                  id: events.id,
                  title: events.title,
                  thumbnailId: events.thumbnailId,
                  startsAt: events.startsAt,
                  endsAt: events.endsAt,
                  joinStatus: participants.registrationStatus,
                },
              ]
            : [],
        ),
        volunteerEvents: volunteersRows.flatMap(({ volunteers, events }) =>
          events && volunteers
            ? [
                {
                  id: events.id,
                  title: events.title,
                  thumbnailId: events.thumbnailId,
                  startsAt: events.startsAt,
                  endsAt: events.endsAt,
                  volunteerType:
                    volunteers.inviteStatus !== null ? "invited" : "registered",
                  volunteerStatus:
                    volunteers.inviteStatus || volunteers.registrationStatus,
                },
              ]
            : [],
        ),
      };

      return c.json(result);
    },
  );

export default app;

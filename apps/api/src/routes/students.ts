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

const app = new Hono()
  .get("/", enforceAuthMiddleware(["admin", "teacher"]), async (c) => {
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
  })
  .get(
    "/:id",
    enforceAuthMiddleware(),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const user = c.var.user;
      const { id } = c.req.valid("param");

      if (!["teacher", "admin"].includes(user.role) && user.id !== id)
        throw new ForbiddenException();

      const volunteerEvents = alias(eventsTable, "volunteer_events");

      const rows = await db
        .select({
          user: usersTable,
          event: eventsTable,
          participation: participantsTable,
          student: studentsTable,
          volunteerEvent: volunteerEvents,
          volunteer: volunteersTable,
        })
        .from(studentsTable)
        .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
        .leftJoin(
          participantsTable,
          eq(participantsTable.studentId, studentsTable.userId),
        )
        .leftJoin(eventsTable, eq(eventsTable.id, participantsTable.eventId))
        .leftJoin(
          volunteersTable,
          eq(volunteersTable.studentId, studentsTable.userId),
        )
        .leftJoin(
          volunteerEvents,
          eq(volunteerEvents.id, volunteersTable.eventId),
        )
        .where(
          or(eq(studentsTable.userId, id), eq(studentsTable.studentId, id)),
        );

      if (rows.length === 0 || !rows[0])
        throw new NotFoundException(
          `Could not find the student with id: ${id}`,
        );

      const student = {
        id: rows[0].user.id,
        name: rows[0].user.name,
        displayImage: rows[0].user.displayImage,
        email: rows[0].user.email,
        studentId: rows[0].student.studentId,
        department: rows[0].student.department,
        batch: rows[0].student.batch,
        events: rows.flatMap(({ event, participation }) =>
          event && participation
            ? [
                {
                  id: event.id,
                  title: event.title,
                  thumbnail: event.thumbnail,
                  startsAt: event.startsAt,
                  endsAt: event.endsAt,
                  joinStatus: participation.registrationStatus,
                },
              ]
            : [],
        ),
        volunteerEvents: rows.flatMap(({ volunteer, volunteerEvent }) =>
          volunteerEvent && volunteer
            ? [
                {
                  id: volunteerEvent.id,
                  title: volunteerEvent.title,
                  thumbnail: volunteerEvent.thumbnail,
                  startsAt: volunteerEvent.startsAt,
                  endsAt: volunteerEvent.endsAt,
                  volunteerType:
                    volunteer.inviteStatus !== null ? "invited" : "registered",
                  volunteerStatus:
                    volunteer.inviteStatus || volunteer.registrationStatus,
                },
              ]
            : [],
        ),
      };

      return c.json(student);
    },
  );

export default app;

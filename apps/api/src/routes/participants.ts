import { createParticipantSchema } from "@festhub/shared/validation";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { db } from "@festhub/db";
import {
  eventsTable,
  participantsTable,
  studentsTable,
  usersTable,
} from "@festhub/db/schema";
import { and, eq } from "drizzle-orm";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import z from "zod";
import { NotFoundException } from "../exceptions/not-found-exception.js";

const app = new Hono()
  .post(
    "/",
    enforceAuthMiddleware(["student"]),
    zValidator("json", createParticipantSchema),
    async (c) => {
      const user = c.var.user;
      const body = c.req.valid("json");

      const participant = await db.transaction(async (tx) => {
        const [event] = await tx
          .select({ id: eventsTable.id })
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.id, body.eventId),
              eq(eventsTable.isActive, true),
            ),
          );

        if (!event)
          throw new BadRequestException(
            "Can not participate as the eventId is invalid",
          );

        const [participant] = await tx
          .insert(participantsTable)
          .values({
            eventId: body.eventId,
            studentId: user.id,
            registeredAt: new Date(),
            registrationStatus: "pending",
          })
          .returning();

        return participant;
      });

      return c.json(participant);
    },
  )
  .get(
    "/:eventId",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ eventId: z.uuid() })),
    async (c) => {
      const { eventId } = c.req.valid("param");

      const participants = await db.transaction(async (tx) => {
        const [event] = await tx
          .select({ id: eventsTable.id })
          .from(eventsTable)
          .where(eq(eventsTable.id, eventId));

        if (!event) throw new NotFoundException("Event does not exists");

        const participants = await tx
          .select({
            id: usersTable.id,
            studentId: studentsTable.studentId,
            department: studentsTable.department,
            batch: studentsTable.batch,
            email: usersTable.email,
            name: usersTable.name,
            displayImage: usersTable.displayImage,
            checkedInAt: participantsTable.checkedInAt,
          })
          .from(participantsTable)
          .innerJoin(
            studentsTable,
            eq(studentsTable.userId, participantsTable.studentId),
          )
          .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
          .where(eq(participantsTable.eventId, eventId));

        return participants;
      });

      return c.json(participants);
    },
  );

export default app;

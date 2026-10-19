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
import { and, count, eq, gt, lt, or } from "drizzle-orm";
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
          .select()
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.id, body.eventId),
              eq(eventsTable.isActive, true),
              gt(eventsTable.registrationClosesAt, new Date()),
              lt(eventsTable.registrationOpensAt, new Date()),
            ),
          );

        if (!event)
          throw new NotFoundException(
            "Can not participate as the eventId is invalid",
          );

        if (event.teamBased)
          throw new BadRequestException(
            "Event is team based, can not participate solo",
          );

        const [alreadyAParticipant] = await tx
          .select({ registrationStatus: participantsTable.registrationStatus })
          .from(participantsTable)
          .where(
            and(
              eq(participantsTable.eventId, body.eventId),
              eq(participantsTable.studentId, user.id),
            ),
          );

        if (!!alreadyAParticipant)
          throw new BadRequestException(
            `You have already requested to be a participant in this event, registrationStatus: ${alreadyAParticipant.registrationStatus}`,
          );

        if (event.maxParticipants) {
          const [total] = await tx
            .select({ participants: count() })
            .from(participantsTable)
            .where(
              and(
                eq(participantsTable.eventId, event.id),
                eq(participantsTable.registrationStatus, "accepted"),
              ),
            );

          if (total && total.participants >= event.maxParticipants)
            throw new BadRequestException(
              "Event already has maximum participants of " + total.participants,
            );
        }

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
            registrationStatus: participantsTable.registrationStatus,
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
  )
  .patch(
    "/:eventId/action",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("param", z.object({ eventId: z.uuid() })),
    zValidator(
      "json",
      z.object({
        studentId: z.uuid(),
        action: z.enum(["accepted", "rejected"]),
      }),
    ),
    async (c) => {
      const { eventId } = c.req.valid("param");
      const { studentId, action } = c.req.valid("json");

      const participant = await db.transaction(async (tx) => {
        const [event] = await tx
          .select({ id: eventsTable.id })
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.id, eventId),
              gt(eventsTable.endsAt, new Date()),
            ),
          );

        if (!event)
          throw new NotFoundException("Event not found or has already ended");

        const [participant] = await tx
          .update(participantsTable)
          .set({
            registrationStatus: action,
            registrationAcceptedAt: action === "accepted" ? new Date() : null,
          })
          .where(
            and(
              eq(participantsTable.eventId, eventId),
              eq(participantsTable.studentId, studentId),
              or(
                eq(participantsTable.registrationStatus, "pending"),
                eq(participantsTable.registrationStatus, "rejected"),
              ),
            ),
          )
          .returning();

        if (!participant)
          throw new BadRequestException(
            "Couldn't update the registration status, participant record is invalid",
          );
        return participant;
      });

      return c.json(participant);
    },
  );

export default app;

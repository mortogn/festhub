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
import { and, count, eq, gt, isNull, lt, or } from "drizzle-orm";
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
  .delete(
    "/:id",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("query", z.object({ eventId: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { eventId } = c.req.valid("query");

      await db.transaction(async (tx) => {
        const [participant] = await tx
          .select()
          .from(participantsTable)
          .where(
            and(
              eq(participantsTable.studentId, id),
              eq(participantsTable.eventId, eventId),
              isNull(participantsTable.teamId),
            ),
          )
          .for("update");

        if (!participant)
          throw new BadRequestException(
            "Participants does not exists or belongs to a team",
          );

        await tx
          .delete(participantsTable)
          .where(
            and(
              eq(participantsTable.studentId, participant.studentId),
              eq(participantsTable.eventId, participant.eventId),
            ),
          );
      });

      return c.json({ studentId: id, status: "deleted" as const });
    },
  );

export default app;

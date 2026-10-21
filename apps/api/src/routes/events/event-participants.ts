import { db } from "@festhub/db";
import {
  eventsTable,
  usersTable,
  studentsTable,
  participantsTable,
} from "@festhub/db/schema";
import { zValidator } from "@hono/zod-validator";
import { eq, and, gt, or, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { NotFoundException } from "../../exceptions/not-found-exception.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";

const app = new Hono()
  .get(
    "/:id/participants",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");

      const participants = await db.transaction(async (tx) => {
        const [event] = await tx
          .select({ id: eventsTable.id })
          .from(eventsTable)
          .where(eq(eventsTable.id, id));

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
          .where(eq(participantsTable.eventId, id));

        return participants;
      });

      return c.json(participants);
    },
  )
  .patch(
    "/:id/participants",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator(
      "json",
      z.object({
        studentId: z.uuid(),
        action: z.enum(["accepted", "rejected"]),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { studentId, action } = c.req.valid("json");

      const participant = await db.transaction(async (tx) => {
        const [event] = await tx
          .select({
            id: eventsTable.id,
            maxParticipants: eventsTable.maxParticipants,
            totalParticipants: tx.$count(
              participantsTable,
              and(
                isNotNull(participantsTable.registrationAcceptedAt),
                eq(participantsTable.eventId, eventsTable.id),
              ),
            ),
          })
          .from(eventsTable)
          .where(
            and(eq(eventsTable.id, id), gt(eventsTable.endsAt, new Date())),
          );

        if (!event)
          throw new NotFoundException("Event not found or has already ended");

        if (
          event.maxParticipants &&
          event.totalParticipants >= event.maxParticipants
        )
          throw new BadRequestException(
            `Event has already reached it's maximum participants number of ${event.maxParticipants}`,
          );

        const [participant] = await tx
          .update(participantsTable)
          .set({
            registrationStatus: action,
            registrationAcceptedAt: action === "accepted" ? new Date() : null,
          })
          .where(
            and(
              eq(participantsTable.eventId, id),
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

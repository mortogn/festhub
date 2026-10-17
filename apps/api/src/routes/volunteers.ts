import { Hono } from "hono";
import { Variables } from "../server.js";
import { zValidator } from "@hono/zod-validator";
import { inviteVolunteerSchema } from "@festhub/shared/validation";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { db } from "@festhub/db";
import {
  eventsTable,
  studentsTable,
  usersTable,
  volunteersTable,
} from "@festhub/db/schema";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { alias } from "drizzle-orm/pg-core";

const app = new Hono<{ Variables: Variables }>()
  .post(
    "/invite",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("json", inviteVolunteerSchema),
    async (c) => {
      const body = c.req.valid("json");
      const user = c.var.user;

      try {
        const invite = await db.transaction(async (tx) => {
          const [student] = await tx
            .select()
            .from(studentsTable)
            .where(eq(studentsTable.userId, body.studentId));

          if (!student) throw new NotFoundException("Student not found");

          const [volunteer] = await tx
            .select()
            .from(volunteersTable)
            .where(
              and(
                eq(volunteersTable.studentId, body.studentId),
                eq(volunteersTable.eventId, body.eventId),
              ),
            );

          if (volunteer?.registeredAt)
            throw new BadRequestException(
              `The student has already registered for volunteering. The status is ${volunteer.registrationStatus}`,
            );

          if (
            volunteer?.inviteStatus === "accepted" ||
            volunteer?.registrationStatus === "approved"
          )
            throw new BadRequestException(
              "The student is already a volunteer for the current event.",
            );

          const [invite] = await tx
            .insert(volunteersTable)
            .values({
              studentId: body.studentId,
              eventId: body.eventId,
              invitationSentAt: new Date(),
              inviteStatus: "pending",
              invitedById: user.authenticated ? user.id : null,
            })
            .onConflictDoUpdate({
              target: [volunteersTable.studentId, volunteersTable.eventId],
              set: {
                registeredAt: null,
                registrationStatus: null,
                invitedById: user.authenticated ? user.id : null,
                inviteStatus: "pending",
                invitationSentAt: new Date(),
              },
            })
            .returning({ studentId: volunteersTable.studentId });

          if (!invite)
            throw new InternalServerErrorException(
              "Something went wrong during volunteer invite.",
            );

          return invite;
        });

        return c.json(invite);
      } catch (err) {
        if (err instanceof HTTPException) throw err;
        throw new InternalServerErrorException("Internal server error", err);
      }
    },
  )
  .post("/register")
  .put("/invite/:id/:action")
  .put("/request/:id/:action")
  .get("/")
  .get(
    "/:eventId",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ eventId: z.uuid() })),
    async (c) => {
      const { eventId } = c.req.valid("param");

      const invitedByUser = alias(usersTable, "invited_by_user");

      try {
        const volunteers = await db
          .select({
            student: {
              id: usersTable.id,
              name: usersTable.name,
              email: usersTable.email,
              studentId: studentsTable.studentId,
            },
            invitedBy: {
              id: invitedByUser.id,
              role: invitedByUser.role,
              name: invitedByUser.name,
            },
            invitationSentAt: volunteersTable.invitationSentAt,
            registeredAt: volunteersTable.registeredAt,
            inviteStatus: volunteersTable.inviteStatus,
            registrationStatus: volunteersTable.registrationStatus,
            assignedAt: volunteersTable.assignedAt,
            checkedInAt: volunteersTable.checkedInAt,
            checkedOutAt: volunteersTable.checkedOutAt,
          })
          .from(volunteersTable)
          .where(eq(volunteersTable.eventId, eventId))
          .innerJoin(
            studentsTable,
            eq(studentsTable.userId, volunteersTable.studentId),
          )
          .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
          .innerJoin(
            invitedByUser,
            eq(invitedByUser.id, volunteersTable.invitedById),
          )
          .orderBy(
            desc(volunteersTable.assignedAt),
            desc(volunteersTable.invitationSentAt),
            desc(volunteersTable.registeredAt),
          );

        return c.json(volunteers);
      } catch (err) {
        if (err instanceof HTTPException) throw err;
        throw new InternalServerErrorException("Internal server error", err);
      }
    },
  );

export default app;

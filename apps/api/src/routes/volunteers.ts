import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  inviteVolunteerSchema,
  registerVolunteerSchema,
} from "@festhub/shared/validation";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { db } from "@festhub/db";
import {
  eventsTable,
  studentsTable,
  usersTable,
  volunteersTable,
} from "@festhub/db/schema";
import { and, count, desc, eq, gt, lt, or } from "drizzle-orm";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { alias } from "drizzle-orm/pg-core";
import { Variables } from "../types/variables.js";

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
  .post(
    "/register",
    enforceAuthMiddleware(["student"]),
    zValidator("json", registerVolunteerSchema),
    async (c) => {
      const body = c.req.valid("json");

      const user = c.var.user;

      try {
        const volunteer = await db.transaction(async (tx) => {
          const [currentEvent] = await tx
            .select()
            .from(eventsTable)
            .where(
              and(
                eq(eventsTable.id, body.eventId),
                eq(eventsTable.isActive, true),
                eq(eventsTable.volunteerRegistration, "open"),
                gt(eventsTable.endsAt, new Date()),
              ),
            )
            .for("update");

          if (!currentEvent) throw new BadRequestException("Invalid Event");

          if (currentEvent.maxVolunteers) {
            const [totalVolunteer] = await tx
              .select({
                count: count(),
              })
              .from(volunteersTable)
              .where(
                and(
                  eq(volunteersTable.eventId, body.eventId),
                  or(
                    eq(volunteersTable.inviteStatus, "accepted"),
                    eq(volunteersTable.registrationStatus, "approved"),
                  ),
                ),
              );

            if (
              totalVolunteer &&
              totalVolunteer?.count >= currentEvent.maxVolunteers
            )
              throw new BadRequestException(
                "Event already have maximum volunteers",
              );
          }

          const [alreadyVolunteer] = await tx
            .select()
            .from(volunteersTable)
            .where(
              and(
                eq(volunteersTable.studentId, user.id),
                eq(volunteersTable.eventId, body.eventId),
              ),
            );

          if (
            alreadyVolunteer?.inviteStatus === "accepted" ||
            alreadyVolunteer?.registrationStatus === "approved"
          )
            throw new BadRequestException(
              "You are already a volunteer at this event",
            );

          if (alreadyVolunteer?.registeredAt)
            throw new BadRequestException(
              `You have already registered for this event as a volunteer`,
            );

          if (alreadyVolunteer?.invitationSentAt)
            throw new BadRequestException(
              "You are already invited for this event as a volunteer.",
            );

          if (!!alreadyVolunteer)
            throw new BadRequestException(
              "You are unable to register again, contact teachers for an invite.",
            );

          if (currentEvent.volunteerStartsAt && currentEvent.volunteerEndsAt) {
            const conflictingEvents = await tx
              .select()
              .from(volunteersTable)
              .innerJoin(
                eventsTable,
                eq(volunteersTable.eventId, eventsTable.id),
              )
              .where(
                and(
                  eq(volunteersTable.studentId, user.id),
                  gt(eventsTable.endsAt, new Date()),
                  lt(
                    eventsTable.volunteerStartsAt,
                    currentEvent.volunteerEndsAt,
                  ),
                  gt(
                    eventsTable.volunteerEndsAt,
                    currentEvent.volunteerStartsAt,
                  ),
                  or(
                    eq(volunteersTable.inviteStatus, "accepted"),
                    eq(volunteersTable.registrationStatus, "approved"),
                  ),
                ),
              );

            if (conflictingEvents.length > 0)
              throw new BadRequestException(
                "You already have a volunteer duty during this event time",
              );
          }

          const [volunteer] = await tx
            .insert(volunteersTable)
            .values({
              eventId: body.eventId,
              studentId: user.id,
              registeredAt: new Date(),
              registrationStatus: "pending",
            })
            .returning({
              eventId: volunteersTable.eventId,
              studentId: volunteersTable.studentId,
            });

          return volunteer;
        });

        if (!volunteer) throw new InternalServerErrorException();

        return c.json(volunteer);
      } catch (err) {
        if (err instanceof HTTPException) throw err;
        throw new InternalServerErrorException("Internal Server Error", err);
      }
    },
  )
  .put("/invite/:id/:action")
  .put("/request/:id/:action")
  .get(
    "/",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator(
      "query",
      z.object({
        filter: z.enum(["active", "all"]).default("active"),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query");

      const invitedByUser = alias(usersTable, "invited_by_user");

      try {
        let volunteers = db
          .select({
            eventId: volunteersTable.eventId,
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
          .innerJoin(
            studentsTable,
            eq(studentsTable.userId, volunteersTable.studentId),
          )
          .innerJoin(eventsTable, eq(eventsTable.id, volunteersTable.eventId))
          .leftJoin(
            invitedByUser,
            eq(volunteersTable.invitedById, invitedByUser.id),
          )
          .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
          .orderBy(
            desc(volunteersTable.assignedAt),
            desc(volunteersTable.invitationSentAt),
            desc(volunteersTable.registeredAt),
          )
          .$dynamic();

        if (query.filter === "active") {
          volunteers = volunteers.where(
            gt(eventsTable.volunteerEndsAt, new Date()),
          );
        }

        return c.json(await volunteers);
      } catch (err) {
        throw new InternalServerErrorException("Internal Server Error", err);
      }
    },
  )
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
            eventId: volunteersTable.eventId,
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
          .leftJoin(
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

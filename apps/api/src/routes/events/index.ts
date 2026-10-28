import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  createEventSchema,
  updateEventSchema,
} from "@festhub/shared/validation";
import { Variables } from "../../server.js";
import { db } from "@festhub/db";
import {
  contestsTable,
  eventsTable,
  participantsTable,
  studentsTable,
  teamsTable,
  usersTable,
  venuesTable,
  volunteersTable,
} from "@festhub/db/schema";
import { InternalServerErrorException } from "../../exceptions/internal-server-error-exception.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import {
  and,
  desc,
  getTableColumns,
  eq,
  lt,
  gt,
  ne,
  isNotNull,
  sql,
  count,
  or,
  isNull,
} from "drizzle-orm";
import z from "zod";
import { NotFoundException } from "../../exceptions/not-found-exception.js";
import { HTTPException } from "hono/http-exception";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";

import eventVenuesRoute from "./event-venues.js";
import eventParticipantsRoute from "./event-participants.js";
import eventTeamsRoute from "./event-teams.js";
import eventQrRoute from "./event-qr.js";

import { alias } from "drizzle-orm/pg-core";

const app = new Hono<{ Variables: Variables }>()
  .post(
    "/",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("json", createEventSchema),
    async (c) => {
      const body = c.req.valid("json");

      const [event] = await db
        .insert(eventsTable)
        .values({
          title: body.title,
          description: body.description,
          type: body.type,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
        })
        .returning({ id: eventsTable.id });

      if (!event) throw new InternalServerErrorException();

      return c.json({ id: event?.id });
    },
  )
  .put(
    "/:id",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("json", updateEventSchema),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const body = c.req.valid("json");
      const param = c.req.valid("param");

      const event = await db.transaction(async (tx) => {
        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(eq(eventsTable.id, param.id))
          .for("update");

        if (!event) throw new BadRequestException("Event not found");

        if (body.teamBased && !event.teamBased) {
          const [participant] = await tx
            .select({ count: count() })
            .from(participantsTable)
            .where(eq(participantsTable.eventId, event.id))
            .limit(1);

          if (participant && participant.count > 0)
            throw new BadRequestException(
              `The event already has participants, to change the event type to "team based", remove the participants`,
            );
        }

        if (
          "teamBased" in body &&
          body.teamBased === false &&
          event.teamBased
        ) {
          const [registeredTeam] = await tx
            .select({ count: count() })
            .from(teamsTable)
            .where(
              and(
                eq(teamsTable.eventId, event.id),
                isNotNull(teamsTable.registeredAt),
              ),
            )
            .limit(1);

          if (registeredTeam && registeredTeam.count > 0)
            throw new BadRequestException(
              `The event already has teams, to change the event type to "individual, remove the teams`,
            );

          await tx
            .delete(teamsTable)
            .where(
              and(
                eq(teamsTable.eventId, event.id),
                isNull(teamsTable.registeredAt),
              ),
            );
        }

        if (
          ("volunteerStartsAt" in body &&
            event.volunteerStartsAt &&
            event.volunteerStartsAt !== body.volunteerStartsAt) ||
          ("volunteerEndsAt" in body &&
            event.volunteerEndsAt &&
            event.volunteerEndsAt !== body.volunteerEndsAt)
        ) {
          const volunteers = await tx
            .select()
            .from(volunteersTable)
            .where(
              and(
                eq(volunteersTable.eventId, event.id),
                or(
                  eq(volunteersTable.registrationStatus, "approved"),
                  eq(volunteersTable.inviteStatus, "accepted"),
                ),
              ),
            );

          if (volunteers && volunteers.length > 0) {
            const otherEvents = alias(eventsTable, "other_events");
            const otherVolunteers = alias(volunteersTable, "other_volunteeers");

            const [conflict] = await tx
              .select({
                studentName: usersTable.name,
                studentId: studentsTable.studentId,
                userId: studentsTable.userId,
                conflictEventId: otherEvents.id,
                conflictEventTitle: otherEvents.title,
              })
              .from(volunteersTable)
              .innerJoin(
                studentsTable,
                eq(studentsTable.userId, volunteersTable.studentId),
              )
              .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
              .innerJoin(
                otherVolunteers,
                eq(otherVolunteers.studentId, volunteersTable.studentId),
              )
              .innerJoin(
                otherEvents,
                eq(otherEvents.id, otherVolunteers.eventId),
              )
              .where(
                and(
                  eq(volunteersTable.eventId, event.id),
                  ne(otherEvents.id, event.id),

                  or(
                    gt(otherEvents.volunteerEndsAt, new Date()),
                    gt(otherEvents.endsAt, new Date()),
                  ),

                  lt(
                    otherEvents.volunteerStartsAt,
                    otherEvents.volunteerEndsAt,
                  ),
                  gt(
                    otherEvents.volunteerEndsAt,
                    otherEvents.volunteerStartsAt,
                  ),

                  or(
                    eq(otherVolunteers.registrationStatus, "approved"),
                    eq(otherVolunteers.inviteStatus, "accepted"),
                  ),
                ),
              )
              .limit(1);

            if (conflict)
              throw new BadRequestException(`
                Volunteer ${conflict.studentName} (ID: ${conflict.studentId}) has a schedule conflict
                with Event: ${conflict.conflictEventTitle} (ID: ${conflict.conflictEventId}),
                Can not update event until the schedule conflict is solved
              `);
          }
        }

        const [updatedEvent] = await tx
          .update(eventsTable)
          .set({
            title: body.title,
            description: body.description,
            type: body.type,
            startsAt: body.startsAt,
            endsAt: body.endsAt,
            registrationOpensAt: body.registrationOpensAt,
            registrationClosesAt: body.registrationClosesAt,
            volunteerStartsAt: body.volunteerStartsAt,
            volunteerEndsAt: body.volunteerEndsAt,
            maxVolunteers: body.maxVolunteers,
            isActive: body.isActive,
            teamBased: body.teamBased,
            maxTeamSize: body.maxTeamSize,
            minTeamSize: body.minTeamSize,
            maxTeams: body.maxTeams,
            volunteerRegistration: body.volunteerRegistration,
            maxParticipants: body.maxParticipants,
          })
          .where(eq(eventsTable.id, param.id))
          .returning({ id: eventsTable.id });

        if (!updatedEvent)
          throw new InternalServerErrorException(
            "Something went wrong updating the event, please try again later",
          );

        return updatedEvent;
      });

      return c.json({ id: event.id });
    },
  )
  .get("/", async (c) => {
    const user = c.var.user;

    let eventsQuery = db
      .select({
        id: eventsTable.id,
        title: eventsTable.title,
        teamBased: eventsTable.teamBased,
        type: eventsTable.type,
        startsAt: eventsTable.startsAt,
        endsAt: eventsTable.endsAt,
        isActive: eventsTable.isActive,
        volunteerRegistration: eventsTable.volunteerRegistration,
        volunteerStartsAt: eventsTable.volunteerStartsAt,
        volunteerEndsAt: eventsTable.volunteerEndsAt,
        registrationOpensAt: eventsTable.registrationOpensAt,
        registrationClosesAt: eventsTable.registrationClosesAt,
        description: sql<string>`LEFT(${eventsTable.description}, 200)`,
        thumbnailId: eventsTable.thumbnailId,
        contestSlug: contestsTable.slug,
        venue: {
          id: venuesTable.id,
          title: venuesTable.title,
          thumbnailId: venuesTable.thumbnailId,
        },
      })
      .from(eventsTable)
      .leftJoin(venuesTable, eq(venuesTable.id, eventsTable.venueId))
      .leftJoin(
        contestsTable,
        and(
          eq(contestsTable.eventId, eventsTable.id),
          eq(contestsTable.isActive, true),
        ),
      )
      .orderBy(desc(eventsTable.startsAt))
      .$dynamic();

    try {
      // if user is not a teacher or admin, only allow active events

      if (user.authenticated && ["admin", "teacher"].includes(user.role)) {
        return c.json(await eventsQuery);
      } else {
        eventsQuery = eventsQuery.where(eq(eventsTable.isActive, true));
        return c.json(await eventsQuery);
      }
    } catch (err) {
      throw new InternalServerErrorException("Internal Server Error", err);
    }
  })
  .get("/:id", zValidator("param", z.object({ id: z.uuid() })), async (c) => {
    const user = c.var.user;

    const { id } = c.req.valid("param");

    try {
      // Only the slug of a live contest is exposed so clients can link to it.
      let eventQuery = db
        .select({
          ...getTableColumns(eventsTable),
          contestSlug: contestsTable.slug,
        })
        .from(eventsTable)
        .leftJoin(
          contestsTable,
          and(
            eq(contestsTable.eventId, eventsTable.id),
            eq(contestsTable.isActive, true),
          ),
        )
        .$dynamic();

      let conditions = [eq(eventsTable.id, id)];

      // if user is not a teacher or admin, only allow active events
      if (!user.authenticated || !["admin", "teacher"].includes(user.role))
        conditions.push(eq(eventsTable.isActive, true));

      if (conditions.length > 0)
        eventQuery = eventQuery.where(and(...conditions));

      const [event] = await eventQuery;

      if (!event) throw new NotFoundException("Event not found");

      const { attendanceQrToken, ...safeEvent } = event;

      return c.json(safeEvent);
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new InternalServerErrorException("Internal Server Error", err);
    }
  })
  .route("/", eventVenuesRoute)
  .route("/", eventParticipantsRoute)
  .route("/", eventTeamsRoute)
  .route("/:id/attendance", eventQrRoute);

export default app;

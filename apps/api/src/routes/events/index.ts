import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  createEventSchema,
  updateEventSchema,
} from "@festhub/shared/validation";
import { Variables } from "../../server.js";
import { db } from "@festhub/db";
import {
  eventsTable,
  participantsTable,
  studentsTable,
  TeamSelect,
  teamsTable,
  usersTable,
  venuesTable,
} from "@festhub/db/schema";
import { InternalServerErrorException } from "../../exceptions/internal-server-error-exception.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { and, desc, eq, lt, gt, ne, isNotNull } from "drizzle-orm";
import z from "zod";
import { NotFoundException } from "../../exceptions/not-found-exception.js";
import { HTTPException } from "hono/http-exception";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";

import eventVenuesRoute from "./event-venues.js";
import eventParticipantsRoute from "./event-participants.js";

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

      const [event] = await db
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

      if (!event) throw new NotFoundException();

      return c.json({ id: event?.id });
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
      })
      .from(eventsTable)
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
      let eventQuery = db.select().from(eventsTable).$dynamic();

      let conditions = [eq(eventsTable.id, id)];

      // if user is not a teacher or admin, only allow active events
      if (!user.authenticated || !["admin", "teacher"].includes(user.role))
        conditions.push(eq(eventsTable.isActive, true));

      if (conditions.length > 0)
        eventQuery = eventQuery.where(and(...conditions));

      const [event] = await eventQuery;

      if (!event) throw new NotFoundException("Event not found");

      return c.json(event);
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new InternalServerErrorException("Internal Server Error", err);
    }
  })
  .route("/", eventVenuesRoute)
  .route("/", eventParticipantsRoute)
  .get(
    "/:id/teams",
    enforceAuthMiddleware(["teacher"]),
    zValidator("param", z.object({ eventId: z.uuid() })),
    async (c) => {
      const { eventId } = c.req.valid("param");

      const teams = await db
        .select({
          team: teamsTable,
          member: {
            id: usersTable.id,
            email: usersTable.email,
            displayImage: usersTable.displayImage,
            department: studentsTable.department,
            batch: studentsTable.batch,
            studentId: studentsTable.studentId,
          },
        })
        .from(teamsTable)
        .leftJoin(
          participantsTable,
          eq(participantsTable.teamId, teamsTable.id),
        )
        .leftJoin(
          studentsTable,
          eq(participantsTable.studentId, studentsTable.userId),
        )
        .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .where(
          and(
            eq(teamsTable.eventId, eventId),
            isNotNull(teamsTable.registeredAt),
          ),
        );

      const teamMap = new Map<
        TeamSelect["id"],
        TeamSelect & {
          members: Array<(typeof teams)[number]["member"]>;
        }
      >();

      teams.filter(({ team, member }) => {
        let item = teamMap.get(team.id);

        if (!item) {
          item = {
            ...team,
            members: [],
          };

          teamMap.set(team.id, item);
        }

        if (member) item.members.push(member);
      });

      return c.json([...teamMap.values()]);
    },
  );

export default app;

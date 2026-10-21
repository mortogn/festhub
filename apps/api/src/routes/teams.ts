import { Hono } from "hono";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import { createTeamSchema } from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  eventsTable,
  participantsTable,
  studentsTable,
  teamInvitationsTable,
  teamsTable,
  usersTable,
} from "@festhub/db/schema";
import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import z from "zod";
import teamInvitesRoute from "./team-invites.js";
import { alias } from "drizzle-orm/pg-core";

const app = new Hono()
  .post(
    "/",
    enforceAuthMiddleware(["student"]),
    zValidator("json", createTeamSchema),
    async (c) => {
      const { eventId, name } = c.req.valid("json");
      const user = c.var.user;

      const team = await db.transaction(async (tx) => {
        const [event] = await tx
          .select({
            id: eventsTable.id,
            totalTeam: count(teamsTable.id),
            maxTeams: eventsTable.maxTeams,
            registrationOpensAt: eventsTable.registrationOpensAt,
            registrationClosesAt: eventsTable.registrationClosesAt,
          })
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.id, eventId),
              eq(eventsTable.isActive, true),
              eq(eventsTable.teamBased, true),
            ),
          )
          .leftJoin(
            teamsTable,
            and(
              eq(teamsTable.eventId, eventsTable.id),
              eq(teamsTable.status, "accepted"),
            ),
          )
          .groupBy(eventsTable.id);

        if (!event)
          throw new NotFoundException(
            "The event does not exists or is not team based",
          );

        if (event.registrationOpensAt && event.registrationOpensAt > new Date())
          throw new BadRequestException("Event registration hasn't opened yet");

        if (
          event.registrationClosesAt &&
          event.registrationClosesAt < new Date()
        )
          throw new BadRequestException(
            "Event registration has already been closed",
          );

        if (event.maxTeams && event.totalTeam >= event.maxTeams)
          throw new BadRequestException(
            "Event has already reached maximum team capacity",
          );

        const [alreadyInATeam] = await tx
          .select({
            id: teamsTable.id,
            name: teamsTable.name,
          })
          .from(teamsTable)
          .leftJoin(
            participantsTable,
            eq(participantsTable.teamId, teamsTable.id),
          )
          .leftJoin(
            teamInvitationsTable,
            eq(teamInvitationsTable.teamId, teamsTable.id),
          )
          .where(
            and(
              eq(teamsTable.eventId, event.id),
              or(
                eq(participantsTable.studentId, user.id),
                and(
                  eq(teamInvitationsTable.status, "accepted"),
                  eq(teamInvitationsTable.studentId, user.id),
                ),
                eq(teamsTable.leaderId, user.id),
              ),
            ),
          );

        if (alreadyInATeam)
          throw new BadRequestException(
            `You are already in a team for this event, team name: ${alreadyInATeam.name}`,
          );

        const [takenTeamName] = await tx
          .select({
            id: teamsTable.id,
          })
          .from(teamsTable)
          .where(
            and(eq(teamsTable.name, name), eq(teamsTable.eventId, eventId)),
          );

        if (!!takenTeamName)
          throw new BadRequestException("The team name is already taken");

        const [team] = await tx
          .insert(teamsTable)
          .values({
            eventId: event.id,
            leaderId: user.id,
            name,
            status: "pending",
          })
          .returning();

        if (!team) throw new InternalServerErrorException();

        await tx.insert(participantsTable).values({
          eventId: eventId,
          teamId: team.id,
          studentId: user.id,
        });

        return team;
      });

      if (!team) throw new InternalServerErrorException();

      return c.json(team);
    },
  )
  .get("/", enforceAuthMiddleware(["student"]), async (c) => {
    const user = c.var.user;

    const userTeamIds = db
      .select({
        teamId: participantsTable.teamId,
      })
      .from(participantsTable)
      .where(eq(participantsTable.studentId, user.id));

    const rows = await db
      .select({
        team: teamsTable,
        student: {
          id: studentsTable.studentId,
          name: usersTable.name,
          department: studentsTable.department,
          batch: studentsTable.batch,
          displayImage: usersTable.displayImage,
        },
        event: {
          id: eventsTable.id,
          title: eventsTable.title,
          thumbnail: eventsTable.thumbnail,
          startsAt: eventsTable.startsAt,
          endsAt: eventsTable.endsAt,
        },
      })
      .from(teamsTable)

      .leftJoin(participantsTable, eq(participantsTable.teamId, teamsTable.id))
      .leftJoin(
        studentsTable,
        eq(studentsTable.userId, participantsTable.studentId),
      )
      .leftJoin(usersTable, eq(usersTable.id, studentsTable.userId))
      .leftJoin(eventsTable, eq(eventsTable.id, teamsTable.eventId))
      .where(
        or(
          eq(teamsTable.leaderId, user.id),
          inArray(teamsTable.id, userTeamIds),
        ),
      );

    const teamMap = new Map<
      string,
      Omit<(typeof rows)[number], "student"> & {
        teammates: Pick<(typeof rows)[number], "student">["student"][];
      }
    >();

    rows.forEach(({ team, student, event }) => {
      let item = teamMap.get(team.id);

      if (!item) {
        item = {
          team,
          event,
          teammates: [],
        };

        teamMap.set(team.id, item);
      }

      if (student) {
        item.teammates.push(student);
      }
    });

    return c.json([...teamMap.values()]);
  })
  .patch(
    "/:id/submit",
    enforceAuthMiddleware(["student"]),
    zValidator(
      "param",
      z.object({
        id: z.uuid(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.var.user;

      const teamCount = alias(teamsTable, "team_count");

      const submittedTeam = await db.transaction(async (tx) => {
        const [row] = await tx
          .select({
            team: teamsTable,
            event: eventsTable,
            totalMembers: sql<number>`count(${teamInvitationsTable.id})::int + 1`,
            totalTeams: tx.$count(
              teamCount,
              and(
                eq(teamCount.eventId, eventsTable.id),
                eq(teamCount.status, "accepted"),
              ),
            ),
          })
          .from(teamsTable)
          .innerJoin(eventsTable, eq(eventsTable.id, teamsTable.eventId))
          .leftJoin(
            teamInvitationsTable,
            and(
              eq(teamInvitationsTable.teamId, teamsTable.id),
              eq(teamInvitationsTable.status, "accepted"),
            ),
          )
          .where(
            and(
              eq(teamsTable.id, id),
              eq(teamsTable.leaderId, user.id),
              gt(eventsTable.registrationClosesAt, new Date()),
              eq(eventsTable.isActive, true),
            ),
          )
          .groupBy(teamsTable.id, eventsTable.id);

        if (!row) throw new NotFoundException("Team not found");

        if (row.team.registeredAt !== null)
          throw new BadRequestException(
            "You have already submitted your team for this event",
          );

        if (row.event.minTeamSize && row.totalMembers < row.event.minTeamSize)
          throw new BadRequestException(
            `You need at least ${row.event.minTeamSize} members in your team to register for this event`,
          );

        if (row.event.maxTeamSize && row.totalMembers > row.event.maxTeamSize)
          throw new BadRequestException(
            `You can have a maximum of ${row.event.maxTeamSize} members in your team`,
          );

        if (row.event.maxTeams && row.totalTeams >= row.event.maxTeams)
          throw new BadRequestException(
            `The event already has a maximum number of teams allowed: ${row.event.maxTeams}`,
          );

        const [team] = await tx
          .update(teamsTable)
          .set({ status: "pending", registeredAt: new Date() })
          .where(and(eq(teamsTable.id, id), isNull(teamsTable.registeredAt)))
          .returning();

        if (!team)
          throw new BadRequestException("Team is possibly already submitted");

        await tx
          .update(participantsTable)
          .set({
            registeredAt: team.registeredAt,
            registrationStatus: "pending",
          })
          .where(eq(participantsTable.teamId, id));

        return team;
      });

      return c.json(submittedTeam);
    },
  );

export default app;

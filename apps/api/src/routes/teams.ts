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
import { and, count, eq, gt, inArray, isNull, or, lt } from "drizzle-orm";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import z from "zod";

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
          .from(participantsTable)
          .leftJoin(teamsTable, eq(teamsTable.id, participantsTable.teamId))
          .where(
            and(
              eq(teamsTable.eventId, event.id),
              eq(participantsTable.studentId, user.id),
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
          userId: usersTable.id,
          name: usersTable.name,
          department: studentsTable.department,
          batch: studentsTable.batch,
          displayImageId: usersTable.displayImageId,
        },
        event: {
          id: eventsTable.id,
          title: eventsTable.title,
          thumbnailId: eventsTable.thumbnailId,
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

      const now = new Date();

      const submittedTeam = await db.transaction(async (tx) => {
        const [team] = await tx
          .select()
          .from(teamsTable)
          .where(and(eq(teamsTable.id, id), eq(teamsTable.leaderId, user.id)))
          .for("update");

        if (!team) throw new BadRequestException("Team not found");

        if (team.registeredAt !== null)
          throw new BadRequestException(
            "You have already submitted your team for this event",
          );

        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.id, team.eventId),
              eq(eventsTable.isActive, true),
              gt(eventsTable.registrationClosesAt, now),
              lt(eventsTable.registrationOpensAt, now),
            ),
          );

        if (!event)
          throw new BadRequestException(
            "Event is not valid or the registration is already closed.",
          );

        const totalTeamMembers = await tx.$count(
          participantsTable,
          eq(participantsTable.teamId, team.id),
        );

        const totalTeams = await tx.$count(
          teamsTable,
          and(
            eq(teamsTable.eventId, event.id),
            eq(teamsTable.status, "accepted"),
          ),
        );

        if (event.minTeamSize && totalTeamMembers < event.minTeamSize)
          throw new BadRequestException(
            `You need at least ${event.minTeamSize} members in your team to register for this event`,
          );

        if (event.maxTeamSize && totalTeamMembers > event.maxTeamSize)
          throw new BadRequestException(
            `You can have a maximum of ${event.maxTeamSize} members in your team`,
          );

        if (event.maxTeams && totalTeams >= event.maxTeams)
          throw new BadRequestException(
            `The event already has a maximum number of teams allowed: ${event.maxTeams}`,
          );

        const [submittedTeam] = await tx
          .update(teamsTable)
          .set({ status: "pending", registeredAt: new Date() })
          .where(and(eq(teamsTable.id, id), isNull(teamsTable.registeredAt)))
          .returning();

        if (!submittedTeam)
          throw new BadRequestException("Team is possibly already submitted");

        await tx
          .update(participantsTable)
          .set({
            registeredAt: submittedTeam.registeredAt,
            registrationStatus: "pending",
          })
          .where(eq(participantsTable.teamId, id));

        return submittedTeam;
      });

      return c.json(submittedTeam);
    },
  )
  .delete(
    "/:id",
    enforceAuthMiddleware(["student"]),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.var.user;

      await db.transaction(async (tx) => {
        const [team] = await tx
          .select()
          .from(teamsTable)
          .where(
            and(
              isNull(teamsTable.registeredAt),
              eq(teamsTable.leaderId, user.id),
              eq(teamsTable.id, id),
            ),
          )
          .for("update");

        if (!team)
          throw new BadRequestException(
            "You can only delete the team that you created and is not registered for an event",
          );

        await tx
          .delete(teamsTable)
          .where(
            and(eq(teamsTable.id, id), eq(teamsTable.leaderId, team.leaderId)),
          );
      });

      return c.json({ id: id, status: "deleted" as const });
    },
  )
  .delete(
    "/:id/member",
    enforceAuthMiddleware(["student"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("query", z.object({ memberId: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { memberId } = c.req.valid("query");

      const user = c.var.user;

      await db.transaction(async (tx) => {
        const [team] = await tx
          .select()
          .from(teamsTable)
          .where(
            and(
              eq(teamsTable.id, id),
              eq(teamsTable.leaderId, user.id),
              isNull(teamsTable.registeredAt),
            ),
          )
          .for("update");

        if (!team)
          throw new BadRequestException(
            "You can only delete members of the team that you created and is not registered for an event",
          );

        if (memberId === team.leaderId)
          throw new BadRequestException("Leader can not remove themselves");

        const [member] = await tx
          .select()
          .from(participantsTable)
          .where(
            and(
              eq(participantsTable.studentId, memberId),
              eq(participantsTable.teamId, team.id),
            ),
          );

        if (!member)
          throw new BadRequestException("Student is not a part of the team");

        await tx
          .update(teamInvitationsTable)
          .set({ removedAt: new Date() })
          .where(
            and(
              eq(teamInvitationsTable.teamId, team.id),
              eq(teamInvitationsTable.studentId, memberId),
            ),
          );

        await tx
          .delete(participantsTable)
          .where(
            and(
              eq(participantsTable.studentId, member.studentId),
              eq(participantsTable.teamId, id),
            ),
          );
      });

      return c.json({ memberId: memberId, status: "deleted" as const });
    },
  );

export default app;

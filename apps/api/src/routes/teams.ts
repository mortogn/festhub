import { Hono } from "hono";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import {
  createTeamSchema,
  teamMemberInviteSchema,
} from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  eventsTable,
  participantsTable,
  studentsTable,
  teamInvitationsTable,
  teamsTable,
  usersTable,
} from "@festhub/db/schema";
import { and, count, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import z from "zod";
import { ForbiddenException } from "../exceptions/forbidden-exception.js";

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
  .post(
    "/invite",
    enforceAuthMiddleware(["student"]),
    zValidator("json", teamMemberInviteSchema),
    async (c) => {
      const { studentId, teamId } = c.req.valid("json");
      const user = c.var.user;

      const invite = await db.transaction(async (tx) => {
        const [student] = await tx
          .select()
          .from(studentsTable)
          .where(
            or(
              eq(studentsTable.userId, studentId),
              eq(studentsTable.studentId, studentId),
            ),
          );

        if (!student)
          throw new NotFoundException(
            "Student does not exist on this platform",
          );

        const [team] = await tx
          .select({
            id: teamsTable.id,
            eventId: teamsTable.eventId,
            maxTeamSize: eventsTable.maxTeamSize,
            totalMember: sql<number>`count(${teamInvitationsTable.id})::int + 1`,
            leaderId: teamsTable.leaderId,
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
            and(eq(teamsTable.id, teamId), gt(eventsTable.endsAt, new Date())),
          )
          .groupBy(teamsTable.id, eventsTable.id);

        if (!team)
          throw new BadRequestException(
            "Team is not valid or the event has ended already",
          );

        if (team.leaderId !== user.id) throw new ForbiddenException();

        if (team.maxTeamSize && team.totalMember >= team.maxTeamSize)
          throw new BadRequestException(
            "Your team already have maximum number of allowed members",
          );

        const [alreadyAParticipant] = await tx
          .select()
          .from(teamInvitationsTable)
          .innerJoin(teamsTable, eq(teamsTable.id, teamInvitationsTable.teamId))
          .where(
            and(
              eq(teamInvitationsTable.studentId, student.userId),
              eq(teamInvitationsTable.status, "accepted"),
              eq(teamsTable.eventId, team.eventId),
            ),
          );

        if (alreadyAParticipant)
          throw new BadRequestException("Student is already part of a team");

        const [alreadyInvited] = await tx
          .select({ id: teamInvitationsTable.id })
          .from(teamInvitationsTable)
          .where(
            and(
              eq(teamInvitationsTable.studentId, student.userId),
              eq(teamInvitationsTable.teamId, teamId),
              ne(teamInvitationsTable.status, "rejected"),
            ),
          );

        if (!!alreadyInvited)
          throw new BadRequestException(
            "Duplicate team member invitation sent",
          );

        const [invite] = await tx
          .insert(teamInvitationsTable)
          .values({
            teamId: teamId,
            studentId: student.userId,
            status: "pending",
            invitedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              teamInvitationsTable.studentId,
              teamInvitationsTable.teamId,
            ],
            set: { status: "pending", invitedAt: new Date() },
          })
          .returning();

        return invite;
      });

      if (!invite) throw new InternalServerErrorException();

      return c.json(invite);
    },
  )
  .get("/invites", enforceAuthMiddleware(["student"]), async (c) => {
    const user = c.var.user;

    const invites = await db
      .select()
      .from(teamInvitationsTable)
      .innerJoin(
        studentsTable,
        eq(studentsTable.userId, teamInvitationsTable.studentId),
      )
      .innerJoin(teamsTable, eq(teamsTable.id, teamInvitationsTable.teamId))
      .innerJoin(eventsTable, eq(eventsTable.id, teamsTable.eventId))
      .where(eq(teamInvitationsTable.studentId, user.id));

    return c.json(invites);
  })
  .patch(
    "/invites/:id/action",
    enforceAuthMiddleware(["student"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("json", z.object({ action: z.enum(["accepted", "rejected"]) })),
    async (c) => {
      const user = c.var.user;
      const { action } = c.req.valid("json");
      const { id } = c.req.valid("param");

      const invite = await db.transaction(async (tx) => {
        const [invite] = await tx
          .select()
          .from(teamInvitationsTable)
          .innerJoin(teamsTable, eq(teamsTable.id, teamInvitationsTable.teamId))
          .where(
            and(
              eq(teamInvitationsTable.studentId, user.id),
              eq(teamInvitationsTable.id, id),
              eq(teamInvitationsTable.status, "pending"),
            ),
          );

        if (!invite)
          throw new BadRequestException(
            "Can not accept as the invitation is not valid",
          );

        if (action === "accepted") {
          const [alreadyMember] = await tx
            .select()
            .from(participantsTable)
            .where(
              and(
                eq(participantsTable.eventId, invite.teams.eventId),
                eq(participantsTable.studentId, user.id),
              ),
            )
            .limit(1)
            .for("update");

          if (alreadyMember)
            throw new BadRequestException(
              "You are already a member in a different team for this event.",
            );

          const [event] = await tx
            .select()
            .from(eventsTable)
            .where(
              and(
                gt(eventsTable.registrationClosesAt, new Date()),
                eq(eventsTable.id, invite.teams.eventId),
                eq(eventsTable.teamBased, true),
              ),
            );

          if (!event)
            throw new BadRequestException(
              "Can not accept as the invitation is not valid",
            );

          const [totalMember] = await tx
            .select({
              count: sql<number>`count(*)::int + 1`,
            })
            .from(teamInvitationsTable)
            .where(
              and(
                eq(teamInvitationsTable.status, "accepted"),
                eq(teamInvitationsTable.teamId, invite.teams.id),
              ),
            );

          if (
            totalMember &&
            event.maxTeamSize &&
            totalMember?.count >= event.maxTeamSize
          )
            throw new BadRequestException(
              "Team already has maximum allowed members",
            );
        }

        const [acceptedInvite] = await tx
          .update(teamInvitationsTable)
          .set({
            status: action,
            acceptedAt: action === "accepted" ? new Date() : null,
          })
          .where(eq(teamInvitationsTable.id, invite.team_invitations.id))
          .returning();

        if (action === "accepted") {
          const [participant] = await tx
            .insert(participantsTable)
            .values({
              teamId: invite.teams.id,
              studentId: user.id,
              eventId: invite.teams.eventId,
            })
            .returning();

          if (!participant) throw new InternalServerErrorException();
        }

        return acceptedInvite;
      });

      if (!invite) throw new InternalServerErrorException();

      return c.json(invite);
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
  .patch("/submit", enforceAuthMiddleware(["student"]), async (c) => {})
  .get("/:eventId", enforceAuthMiddleware(["teacher"]), async (c) => {});

export default app;

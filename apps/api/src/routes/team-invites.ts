import { Hono } from "hono";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import { teamMemberInviteSchema } from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  eventsTable,
  participantsTable,
  studentsTable,
  teamInvitationsTable,
  teamsTable,
} from "@festhub/db/schema";
import { and, eq, gt, ne, or, sql } from "drizzle-orm";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import z from "zod";
import { ForbiddenException } from "../exceptions/forbidden-exception.js";

const app = new Hono()
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
  );

export default app;

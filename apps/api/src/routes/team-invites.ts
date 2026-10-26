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
  usersTable,
} from "@festhub/db/schema";
import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import z from "zod";
import { ForbiddenException } from "../exceptions/forbidden-exception.js";
import { lt } from "zod/locales";

const app = new Hono()
  .post(
    "/",
    enforceAuthMiddleware(["student"]),
    zValidator("json", teamMemberInviteSchema),
    async (c) => {
      const { studentId, teamId } = c.req.valid("json");
      const user = c.var.user;

      const isUUID = z.uuid().safeParse(studentId).success;

      const invite = await db.transaction(async (tx) => {
        const [student] = await tx
          .select()
          .from(studentsTable)
          .where(
            isUUID
              ? eq(studentsTable.userId, studentId)
              : eq(studentsTable.studentId, studentId),
          );

        if (!student)
          throw new NotFoundException(
            "Student does not exist on this platform",
          );

        const [team] = await tx
          .select()
          .from(teamsTable)
          .where(
            and(eq(teamsTable.id, teamId), isNull(teamsTable.registeredAt)),
          )
          .for("update");

        if (!team) throw new BadRequestException("Team not found");

        if (team.leaderId !== user.id)
          throw new ForbiddenException(
            "Only team leader can invite other members to the team",
          );

        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.isActive, true),
              gt(eventsTable.registrationClosesAt, new Date()),
              eq(eventsTable.id, team.eventId),
            ),
          );

        if (!event)
          throw new BadRequestException(
            "Event does not exist or the registration has already closed",
          );

        const totalTeamMembers = await tx.$count(
          participantsTable,
          eq(participantsTable.teamId, team.id),
        );

        const totalTeams = await tx.$count(
          teamsTable,
          and(
            eq(teamsTable.status, "accepted"),
            eq(teamsTable.eventId, event.id),
          ),
        );

        if (event.maxTeamSize && totalTeamMembers >= event.maxTeamSize)
          throw new BadRequestException(
            `Your team already have maximum number of allowed members of ${totalTeamMembers}`,
          );

        const [alreadyAParticipant] = await tx
          .select()
          .from(participantsTable)
          .where(
            and(
              eq(participantsTable.studentId, student.userId),
              eq(participantsTable.eventId, event.id),
            ),
          );

        if (alreadyAParticipant)
          throw new BadRequestException(
            "Student is already part of a team for this event",
          );

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
            "Duplicate team member invitation can not be sent",
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

        if (!invite) throw new InternalServerErrorException();

        return invite;
      });

      return c.json(invite);
    },
  )
  .get("/", enforceAuthMiddleware(["student"]), async (c) => {
    const user = c.var.user;

    const invites = await db
      .select({
        id: teamInvitationsTable.id,
        invitedAt: teamInvitationsTable.invitedAt,
        teamName: teamsTable.name,
        teamId: teamsTable.id,
        status: teamInvitationsTable.status,
        removedAt: teamInvitationsTable.removedAt,
        acceptedAt: teamInvitationsTable.acceptedAt,
        leader: {
          studentId: studentsTable.studentId,
          name: usersTable.name,
          displayImageId: usersTable.displayImageId,
          email: usersTable.email,
        },
        event: {
          title: eventsTable.title,
          thumbnailId: eventsTable.thumbnailId,
          startsAt: eventsTable.startsAt,
          endsAt: eventsTable.endsAt,
        },
      })
      .from(teamInvitationsTable)
      .innerJoin(teamsTable, eq(teamsTable.id, teamInvitationsTable.teamId))
      .innerJoin(studentsTable, eq(studentsTable.userId, teamsTable.leaderId))
      .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
      .innerJoin(eventsTable, eq(eventsTable.id, teamsTable.eventId))
      .where(
        and(
          eq(teamInvitationsTable.studentId, user.id),
          isNull(teamsTable.registeredAt),
        ),
      );

    return c.json(invites);
  })
  .patch(
    "/:id",
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
              isNull(teamsTable.registeredAt),
            ),
          );

        if (!invite)
          throw new BadRequestException(
            "Can not accept as the invitation is not valid",
          );

        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(eq(eventsTable.id, invite.teams.eventId))
          .for("update");

        if (!event)
          throw new BadRequestException(
            "Can not accept as the invitation is not valid",
          );

        // lock teams table for stable member count
        const [lockedTeam] = await tx
          .select()
          .from(teamsTable)
          .where(
            and(
              eq(teamsTable.id, invite.teams.id),
              isNull(teamsTable.registeredAt),
            ),
          )
          .for("update");

        if (!lockedTeam)
          throw new BadRequestException(
            "Can not accept team invites as the team is already registered ",
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

          if (
            !event.teamBased ||
            (event.registrationClosesAt &&
              event.registrationClosesAt <= new Date())
          )
            throw new BadRequestException(
              "Can not accept as the invitation is not valid",
            );

          const totalMember = await tx.$count(
            participantsTable,
            eq(participantsTable.teamId, invite.teams.id),
          );

          if (
            totalMember &&
            event.maxTeamSize &&
            totalMember >= event.maxTeamSize
          )
            throw new BadRequestException(
              "Team already has maximum allowed members",
            );
        }

        const [updatedInvite] = await tx
          .update(teamInvitationsTable)
          .set({
            status: action,
            acceptedAt: action === "accepted" ? new Date() : null,
          })
          .where(
            and(
              eq(teamInvitationsTable.id, invite.team_invitations.id),
              eq(teamInvitationsTable.status, "pending"),
            ),
          )
          .returning();

        if (!updatedInvite)
          throw new BadRequestException(
            "Could not update team invite, try again if you have not accepted the invite already",
          );

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

        return updatedInvite;
      });

      if (!invite) throw new InternalServerErrorException();

      return c.json(invite);
    },
  );

export default app;

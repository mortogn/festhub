import { db } from "@festhub/db";
import {
  teamsTable,
  usersTable,
  studentsTable,
  participantsTable,
  TeamSelect,
  eventsTable,
} from "@festhub/db/schema";
import { zValidator } from "@hono/zod-validator";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { id } from "zod/locales";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";

const app = new Hono()
  .get(
    "/:id/teams",
    enforceAuthMiddleware(["teacher"]),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");

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
          and(eq(teamsTable.eventId, id), isNotNull(teamsTable.registeredAt)),
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
  )
  .patch(
    "/:eventId/teams/:teamId",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("param", z.object({ eventId: z.uuid(), teamId: z.uuid() })),
    zValidator(
      "json",
      z.object({
        action: z.enum(["accepted", "rejected"]),
      }),
    ),
    async (c) => {
      const { eventId, teamId } = c.req.valid("param");
      const { action } = c.req.valid("json");

      const updatedTeam = await db.transaction(async (tx) => {
        const [team] = await tx
          .select()
          .from(teamsTable)
          .where(
            and(eq(teamsTable.id, teamId), eq(teamsTable.eventId, eventId)),
          );

        if (!team) throw new BadRequestException("Team not found ");

        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(eq(eventsTable.id, team.eventId))
          .for("update");

        if (!event) throw new BadRequestException("Event not found");

        if (action === "accepted") {
          const totalTeams = await tx.$count(
            teamsTable,
            and(
              eq(teamsTable.eventId, team.eventId),
              eq(teamsTable.status, "accepted"),
            ),
          );

          if (event.maxTeams && totalTeams >= event.maxTeams)
            throw new BadRequestException(
              `Event has already reached maximum allowed team number of ${event.maxTeams}`,
            );

          const totalMembers = await tx.$count(
            participantsTable,
            eq(participantsTable.teamId, team.id),
          );

          if (event.maxTeamSize && totalMembers > event.maxTeamSize)
            throw new BadRequestException(
              `Team size of ${totalMembers} exceeds max size of ${event.maxTeamSize} declared for this`,
            );

          if (event.minTeamSize && totalMembers < event.minTeamSize)
            throw new BadRequestException(
              `Team size of ${totalMembers} does not meet the minimum size of ${event.maxTeamSize} declared for this`,
            );
        }

        const [updatedTeam] = await tx
          .update(teamsTable)
          .set({
            status: action,
            acceptedAt: action === "accepted" ? new Date() : null,
          })
          .where(
            and(eq(teamsTable.id, team.id), eq(teamsTable.status, "pending")),
          )
          .returning();

        if (!updatedTeam)
          throw new BadRequestException(
            "Could not update team status as it has already updated before",
          );

        return updatedTeam;
      });

      return c.json(updatedTeam);
    },
  );

export default app;

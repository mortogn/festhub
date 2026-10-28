import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@festhub/db";
import {
  eventsTable,
  participantsTable,
  problemsTable,
  submissionsTable,
  teamsTable,
  usersTable,
} from "@festhub/db/schema";
import { and, eq } from "drizzle-orm";
import { calculateStandings } from "@festhub/shared/contest";
import type { AppVars } from "../../types/variables.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { NotFoundException } from "../../exceptions/not-found-exception.js";
import { requireContestAccess } from "./access.js";

const app = new Hono<AppVars>().get(
  "/",
  enforceAuthMiddleware(),
  zValidator("param", z.object({ contestId: z.uuid() })),
  async (c) => {
    const { contestId } = c.req.valid("param");
    const { contest } = await requireContestAccess(c, contestId);
    if (!contest.startsAt || !contest.endsAt || !contest.eventId)
      throw new NotFoundException("Contest schedule not found");
    const [event] = await db
      .select({ teamBased: eventsTable.teamBased })
      .from(eventsTable)
      .where(eq(eventsTable.id, contest.eventId));
    const competitors = event!.teamBased
      ? await db
          .select({ id: teamsTable.id, name: teamsTable.name })
          .from(teamsTable)
          .where(
            and(
              eq(teamsTable.eventId, contest.eventId),
              eq(teamsTable.status, "accepted"),
            ),
          )
      : await db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(participantsTable)
          .innerJoin(usersTable, eq(usersTable.id, participantsTable.studentId))
          .where(
            and(
              eq(participantsTable.eventId, contest.eventId),
              eq(participantsTable.registrationStatus, "accepted"),
            ),
          );
    const submissions = await db
      .select({
        id: submissionsTable.id,
        problemId: submissionsTable.problemId,
        teamId: submissionsTable.teamId,
        submittedByUserId: submissionsTable.submittedByUserId,
        submittedAt: submissionsTable.submittedAt,
        status: submissionsTable.status,
        verdict: submissionsTable.verdict,
      })
      .from(submissionsTable)
      .innerJoin(
        problemsTable,
        eq(problemsTable.id, submissionsTable.problemId),
      )
      .where(eq(problemsTable.contestId, contestId));
    const problems = await db
      .select({
        id: problemsTable.id,
        title: problemsTable.title,
        position: problemsTable.position,
      })
      .from(problemsTable)
      .where(eq(problemsTable.contestId, contestId))
      .orderBy(problemsTable.position);
    return c.json({
      teamBased: event!.teamBased,
      problems,
      standings: calculateStandings(
        contest.startsAt,
        contest.endsAt,
        event!.teamBased,
        competitors,
        submissions,
      ),
    });
  },
);
export default app;

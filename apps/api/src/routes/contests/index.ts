import { Hono } from "hono";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import {
  createContestSchema,
  updateContestSchema,
} from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  contestsTable,
  eventsTable,
  problemsTable,
  submissionsTable,
} from "@festhub/db/schema";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { and, count, eq, inArray } from "drizzle-orm";
import z from "zod";
import { AppVars } from "../../types/variables.js";
import { NotFoundException } from "../../exceptions/not-found-exception.js";

import contestProblemsRoute from "./contest-problems.js";
import problemTestCasesRoute from "./problem-test-cases.js";
import problemSubmissionRoute from "./problem-submission.js";
import languagesRoute from "./languages.js";

const app = new Hono<AppVars>()
  .route("/languages", languagesRoute)
  .post(
    "/",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("json", createContestSchema),
    async (c) => {
      const user = c.var.user;

      const body = c.req.valid("json");

      await db.transaction(async (tx) => {
        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(eq(eventsTable.id, body.eventId));

        if (!event) throw new BadRequestException("Event not found");

        const [existingContest] = await tx
          .select()
          .from(contestsTable)
          .where(eq(contestsTable.eventId, event.id));

        if (existingContest)
          throw new BadRequestException(
            "A programming contest already exists linked to this event",
          );

        const [contestWithSlug] = await tx
          .select()
          .from(contestsTable)
          .where(eq(contestsTable.slug, body.slug));

        if (contestWithSlug)
          throw new BadRequestException(
            "Contest with this slug already exists",
          );

        await tx.insert(contestsTable).values(body);
      });

      return c.json({ message: "Contest created successfully" }, 201);
    },
  )
  .get("/:id", zValidator("param", z.object({ id: z.uuid() })), async (c) => {
    const { id } = c.req.valid("param");

    const user = c.var.user;

    let whereClauses = [eq(contestsTable.id, id)];

    if (!user.authenticated || !["teacher", "admin"].includes(user.role)) {
      whereClauses.push(eq(contestsTable.isActive, true));
    }

    const [contest] = await db
      .select()
      .from(contestsTable)
      .where(and(...whereClauses));

    if (!contest) throw new NotFoundException("Contest not found");

    const { password, ...safeContest } = contest;

    return c.json(safeContest);
  })
  .put(
    "/:id",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("json", updateContestSchema),
    async (c) => {
      const { id } = c.req.valid("param");

      const body = c.req.valid("json");

      await db.transaction(async (tx) => {
        const [contest] = await tx
          .select()
          .from(contestsTable)
          .where(eq(contestsTable.id, id))
          .for("update");

        if (!contest) throw new BadRequestException("Contest not found");

        if (body.eventId && contest.eventId !== body.eventId) {
          const [newEvent] = await tx
            .select()
            .from(eventsTable)
            .leftJoin(contestsTable, eq(contestsTable.eventId, eventsTable.id))
            .where(eq(eventsTable.id, body.eventId));

          if (!newEvent) throw new BadRequestException("Event not found");

          if (!!newEvent.contests)
            throw new BadRequestException(
              "A programming contest already exists linked to this event",
            );

          const problems = await tx
            .select({ id: problemsTable.id })
            .from(problemsTable)
            .where(eq(problemsTable.contestId, contest.id));

          const submissionCount = await tx.$count(
            submissionsTable,
            inArray(
              submissionsTable.problemId,
              problems.map((v) => v.id),
            ),
          );

          if (submissionCount > 0)
            throw new BadRequestException(
              "Can not change event as submissions are already present for this contest",
            );
        }

        if (body.slug && contest.slug !== body.slug) {
          const [conflictSlug] = await tx
            .select()
            .from(contestsTable)
            .where(eq(contestsTable.slug, body.slug));

          if (conflictSlug)
            throw new BadRequestException(
              "Contest with this slug already exists",
            );
        }

        if (
          body.endsAt &&
          !body.startsAt &&
          new Date(body.endsAt) <= new Date(contest.startsAt)
        ) {
          throw new BadRequestException(
            "Contest end date cannot be before start date",
          );
        }

        if (
          body.startsAt &&
          !body.endsAt &&
          new Date(body.startsAt) >= new Date(contest.endsAt)
        ) {
          throw new BadRequestException(
            "Contest start date cannot be after end date",
          );
        }

        await tx
          .update(contestsTable)
          .set({ ...body })
          .where(eq(contestsTable.id, contest.id));
      });

      return c.json({ id: id, message: "Contest updated successfully" });
    },
  )
  .route("/:contestId/problems", contestProblemsRoute)
  .route("/:contestId/problems/:problemId/testcases", problemTestCasesRoute)
  .route("/:contestId/problems/:problemId/submission", problemSubmissionRoute);

export default app;

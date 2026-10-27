import { Hono } from "hono";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import {
  createContestSchema,
  updateContestSchema,
  unlockContestSchema,
} from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  contestsTable,
  eventsTable,
  problemsTable,
  submissionsTable,
  participantsTable,
} from "@festhub/db/schema";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { and, eq, inArray, desc } from "drizzle-orm";
import z from "zod";
import { AppVars } from "../../types/variables.js";
import { NotFoundException } from "../../exceptions/not-found-exception.js";

import contestProblemsRoute from "./contest-problems.js";
import problemTestCasesRoute from "./problem-test-cases.js";
import problemSubmissionRoute from "./problem-submission.js";
import languagesRoute from "./languages.js";
import submissionsRoute from "./submissions.js";
import standingsRoute from "./standings.js";
import bcrypt from "bcrypt";
import { getJudgeLimits } from "./_helper.js";
import { requirePublishableContest, validateLanguages } from "./authoring.js";
import {
  isStaff,
  requireContestAccess,
  safeContest,
  unlockContest,
} from "./access.js";

const app = new Hono<AppVars>()
  .use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  })
  .route("/languages", languagesRoute)
  .get("/limits", enforceAuthMiddleware(["teacher", "admin"]), async (c) =>
    c.json(await getJudgeLimits()),
  )
  .get("/", enforceAuthMiddleware(), async (c) => {
    const user = c.var.user;
    if (!user.authenticated) throw new BadRequestException("Sign in required");
    const contests = isStaff(c)
      ? await db
          .select()
          .from(contestsTable)
          .orderBy(desc(contestsTable.startsAt))
      : (
          await db
            .select({ contest: contestsTable })
            .from(contestsTable)
            .innerJoin(
              participantsTable,
              eq(participantsTable.eventId, contestsTable.eventId),
            )
            .where(
              and(
                eq(contestsTable.isActive, true),
                eq(participantsTable.studentId, user.id),
                eq(participantsTable.registrationStatus, "accepted"),
              ),
            )
            .orderBy(desc(contestsTable.startsAt))
        ).map((row) => row.contest);
    return c.json({
      contests: await Promise.all(
        contests.map((contest) => safeContest(c, contest)),
      ),
    });
  })
  .get(
    "/by-slug/:slug",
    zValidator("param", z.object({ slug: z.string().min(1) })),
    async (c) => {
      const { slug } = c.req.valid("param");
      const [contest] = await db
        .select()
        .from(contestsTable)
        .where(
          and(
            eq(contestsTable.slug, slug),
            ...(!isStaff(c) ? [eq(contestsTable.isActive, true)] : []),
          ),
        );
      if (!contest) throw new NotFoundException("Contest not found");
      return c.json(await safeContest(c, contest));
    },
  )
  .post(
    "/:contestId/unlock",
    enforceAuthMiddleware(),
    zValidator("param", z.object({ contestId: z.uuid() })),
    zValidator("json", unlockContestSchema),
    async (c) => {
      const { contest } = await requireContestAccess(
        c,
        c.req.valid("param").contestId,
        { content: false, skipPassword: true },
      );
      await unlockContest(c, contest, c.req.valid("json").password);
      return c.json({ message: "Contest unlocked" });
    },
  )
  .post(
    "/",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("json", createContestSchema),
    async (c) => {
      const body = c.req.valid("json");
      if (body.isActive)
        throw new BadRequestException(
          "Create a draft and add problems before publishing",
        );
      await validateLanguages(body.allowedLanguages);

      const id = await db.transaction(async (tx) => {
        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(eq(eventsTable.id, body.eventId));

        if (!event || event.type !== "contest")
          throw new BadRequestException("A contest event is required");

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

        const [created] = await tx
          .insert(contestsTable)
          .values({
            ...body,
            password: body.password
              ? await bcrypt.hash(body.password, 10)
              : null,
          })
          .returning({ id: contestsTable.id });
        return created!.id;
      });

      return c.json({ id, message: "Contest created successfully" }, 201);
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

    return c.json(await safeContest(c, contest));
  })
  .put(
    "/:id",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("json", updateContestSchema),
    async (c) => {
      const { id } = c.req.valid("param");

      const body = c.req.valid("json");
      await validateLanguages(body.allowedLanguages);

      await db.transaction(async (tx) => {
        const [contest] = await tx
          .select()
          .from(contestsTable)
          .where(eq(contestsTable.id, id))
          .for("update");

        if (!contest) throw new BadRequestException("Contest not found");
        if (body.isActive === true && !contest.isActive)
          await requirePublishableContest(tx, id);

        if (
          contest.startsAt <= new Date() &&
          (body.startsAt !== undefined ||
            body.endsAt !== undefined ||
            body.eventId !== undefined ||
            body.allowedLanguages !== undefined)
        ) {
          throw new BadRequestException(
            "Schedule, event, and languages cannot change after the contest starts",
          );
        }

        if (body.eventId && contest.eventId !== body.eventId) {
          const [newEvent] = await tx
            .select()
            .from(eventsTable)
            .leftJoin(contestsTable, eq(contestsTable.eventId, eventsTable.id))
            .where(eq(eventsTable.id, body.eventId));

          if (!newEvent || newEvent.events.type !== "contest")
            throw new BadRequestException("A contest event is required");

          if (!!newEvent.contests)
            throw new BadRequestException(
              "A programming contest already exists linked to this event",
            );

          const problems = await tx
            .select({ id: problemsTable.id })
            .from(problemsTable)
            .where(eq(problemsTable.contestId, contest.id));

          const submissionCount = problems.length
            ? await tx.$count(
                submissionsTable,
                inArray(
                  submissionsTable.problemId,
                  problems.map((v) => v.id),
                ),
              )
            : 0;

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
          .set({
            ...body,
            ...(body.password !== undefined
              ? {
                  password: body.password
                    ? await bcrypt.hash(body.password, 10)
                    : null,
                }
              : {}),
          })
          .where(eq(contestsTable.id, contest.id));
      });

      return c.json({ id: id, message: "Contest updated successfully" });
    },
  )
  .route("/:contestId/submissions", submissionsRoute)
  .route("/:contestId/standings", standingsRoute)
  .route("/:contestId/problems", contestProblemsRoute)
  .route("/:contestId/problems/:problemId/testcases", problemTestCasesRoute)
  .route("/:contestId/problems/:problemId/submission", problemSubmissionRoute);

export default app;

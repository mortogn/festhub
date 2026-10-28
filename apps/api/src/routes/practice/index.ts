import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@festhub/db";
import {
  contestsTable,
  problemsTable,
  submissionsTable,
  testCasesTable,
} from "@festhub/db/schema";
import {
  createProblemSetSchema,
  updateProblemSetSchema,
} from "@festhub/shared/validation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppVars } from "../../types/variables.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { NotFoundException } from "../../exceptions/not-found-exception.js";
import {
  isStaff,
  requirePracticeAccess,
  safeContest,
} from "../contests/access.js";
import {
  requirePublishableContest,
  validateLanguages,
} from "../contests/authoring.js";
import { createContestProblemsRoute } from "../contests/contest-problems.js";
import { createProblemTestCasesRoute } from "../contests/problem-test-cases.js";
import { createProblemSubmissionRoute } from "../contests/problem-submission.js";
import { createSubmissionsRoute } from "../contests/submissions.js";

type PracticeRow = typeof contestsTable.$inferSelect & {
  problemCount: number;
  solvedCount: number;
};

async function withProgress(
  contests: Array<typeof contestsTable.$inferSelect>,
  userId: string | null,
) {
  if (!contests.length)
    return contests.map((contest) => ({
      ...contest,
      problemCount: 0,
      solvedCount: 0,
    })) satisfies PracticeRow[];
  const ids = contests.map((contest) => contest.id);
  const problemCounts = await db
    .select({
      contestId: problemsTable.contestId,
      count: sql<number>`count(distinct ${problemsTable.id})::int`,
    })
    .from(problemsTable)
    .innerJoin(
      testCasesTable,
      eq(testCasesTable.problemId, problemsTable.id),
    )
    .where(inArray(problemsTable.contestId, ids))
    .groupBy(problemsTable.contestId);
  const solvedCounts = userId
    ? await db
        .select({
          contestId: problemsTable.contestId,
          count: sql<number>`count(distinct ${problemsTable.id})::int`,
        })
        .from(submissionsTable)
        .innerJoin(
          problemsTable,
          eq(problemsTable.id, submissionsTable.problemId),
        )
        .where(
          and(
            eq(submissionsTable.submittedByUserId, userId),
            eq(submissionsTable.verdict, "AC"),
            inArray(problemsTable.contestId, ids),
          ),
        )
        .groupBy(problemsTable.contestId)
    : [];
  const problemCountById = new Map(
    problemCounts.map((row) => [row.contestId, row.count]),
  );
  const solvedCountById = new Map(
    solvedCounts.map((row) => [row.contestId, row.count]),
  );
  return contests.map((contest) => ({
    ...contest,
    problemCount: problemCountById.get(contest.id) ?? 0,
    solvedCount: solvedCountById.get(contest.id) ?? 0,
  })) satisfies PracticeRow[];
}

const app = new Hono<AppVars>()
  .use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  })
  .get("/", enforceAuthMiddleware(), async (c) => {
    const user = c.var.user;
    if (!user.authenticated) throw new BadRequestException("Sign in required");
    const staff = isStaff(c);

    const problemSets = await withProgress(
      await db
        .select()
        .from(contestsTable)
        .where(
          and(
            eq(contestsTable.kind, "problem_set"),
            ...(!staff ? [eq(contestsTable.isActive, true)] : []),
          ),
        )
        .orderBy(desc(contestsTable.createdAt)),
      user.id,
    );

    const pastContests = await withProgress(
      await db
        .select()
        .from(contestsTable)
        .where(
          and(
            eq(contestsTable.kind, "official"),
            eq(contestsTable.isActive, true),
            sql`${contestsTable.endsAt} <= now()`,
          ),
        )
        .orderBy(desc(contestsTable.endsAt)),
      user.id,
    );

    return c.json({
      problemSets: await Promise.all(
        problemSets.map(async (contest) => {
          const { password: _password, ...safe } = contest;
          return {
            ...safe,
            hasPassword: false,
            isLocked: false,
          };
        }),
      ),
      pastContests: await Promise.all(
        pastContests.map(async (contest) => ({
          ...(await safeContest(c, contest)),
          hasPassword: false,
          isLocked: false,
        })),
      ),
    });
  })
  .get(
    "/by-slug/:slug",
    enforceAuthMiddleware(),
    zValidator("param", z.object({ slug: z.string().min(1) })),
    async (c) => {
      const { slug } = c.req.valid("param");
      const [contest] = await db
        .select()
        .from(contestsTable)
        .where(eq(contestsTable.slug, slug));
      if (!contest) throw new NotFoundException("Practice not found");
      const { contest: accessible } = await requirePracticeAccess(
        c,
        contest.id,
      );
      const user = c.var.user;
      const [withCounts] = await withProgress(
        [accessible],
        user.authenticated ? user.id : null,
      );
      return c.json({
        ...(await safeContest(c, accessible)),
        hasPassword: false,
        isLocked: false,
        problemCount: withCounts!.problemCount,
        solvedCount: withCounts!.solvedCount,
      });
    },
  )
  .post(
    "/",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("json", createProblemSetSchema),
    async (c) => {
      const body = c.req.valid("json");
      if (body.isActive)
        throw new BadRequestException(
          "Create a draft and add problems before publishing",
        );
      await validateLanguages(body.allowedLanguages);
      const id = await db.transaction(async (tx) => {
        const [conflict] = await tx
          .select({ id: contestsTable.id })
          .from(contestsTable)
          .where(eq(contestsTable.slug, body.slug));
        if (conflict)
          throw new BadRequestException(
            "A contest or problem set with this slug already exists",
          );
        const [created] = await tx
          .insert(contestsTable)
          .values({
            ...body,
            kind: "problem_set",
            eventId: null,
            startsAt: null,
            endsAt: null,
            password: null,
          })
          .returning({ id: contestsTable.id });
        return created!.id;
      });
      return c.json(
        { id, message: "Problem set created successfully" },
        201,
      );
    },
  )
  .put(
    "/:id",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("json", updateProblemSetSchema),
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
        if (!contest || contest.kind !== "problem_set")
          throw new NotFoundException("Problem set not found");
        if (body.isActive === true && !contest.isActive)
          await requirePublishableContest(tx, id);
        if (body.slug && body.slug !== contest.slug) {
          const [conflict] = await tx
            .select({ id: contestsTable.id })
            .from(contestsTable)
            .where(eq(contestsTable.slug, body.slug));
          if (conflict)
            throw new BadRequestException(
              "A contest or problem set with this slug already exists",
            );
        }
        await tx
          .update(contestsTable)
          .set({ ...body })
          .where(eq(contestsTable.id, id));
      });
      return c.json({ id, message: "Problem set updated successfully" });
    },
  )
  .get(
    "/:id",
    enforceAuthMiddleware(),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { contest } = await requirePracticeAccess(c, id);
      return c.json({
        ...(await safeContest(c, contest)),
        hasPassword: false,
        isLocked: false,
      });
    },
  )
  .route(
    "/:contestId/problems",
    createContestProblemsRoute(requirePracticeAccess, {
      practice: true,
      problemSetsOnly: true,
      withProgress: true,
      hideIncomplete: true,
    }),
  )
  .route(
    "/:contestId/problems/:problemId/testcases",
    createProblemTestCasesRoute(requirePracticeAccess, {
      practice: true,
      problemSetsOnly: true,
    }),
  )
  .route(
    "/:contestId/problems/:problemId/submission",
    createProblemSubmissionRoute(requirePracticeAccess, { practice: true }),
  )
  .route(
    "/:contestId/submissions",
    createSubmissionsRoute(requirePracticeAccess),
  );

export default app;

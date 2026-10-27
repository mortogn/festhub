import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@festhub/db";
import {
  problemsTable,
  submissionsTable,
  testCasesTable,
} from "@festhub/db/schema";
import { problemSubmissionSchema } from "@festhub/shared/validation";
import { and, eq } from "drizzle-orm";
import type { AppVars } from "../../types/variables.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { requireContestAccess } from "./access.js";
import { getJudgeLanguages } from "./_helper.js";
import { enqueueSubmission } from "../../lib/submission-queue.js";
import { listSubmissions, paginationSchema } from "./submissions.js";

const params = zValidator(
  "param",
  z.object({ contestId: z.uuid(), problemId: z.uuid() }),
);
const app = new Hono<AppVars>()
  .post(
    "/",
    enforceAuthMiddleware(["student"]),
    params,
    zValidator("json", problemSubmissionSchema),
    async (c) => {
      const user = c.var.user;
      if (!user.authenticated)
        throw new BadRequestException("Sign in required");
      const { contestId, problemId } = c.req.valid("param");
      const body = c.req.valid("json");
      // Validate languages before acquiring a database lock; never await Judge0 while holding it.
      const languages = await getJudgeLanguages();
      if (!languages.some((language) => language.id === body.languageCode))
        throw new BadRequestException("Unsupported language");
      const submission = await db.transaction(async (tx) => {
        const { contest, participant } = await requireContestAccess(
          c,
          contestId,
          { dbClient: tx, lock: true },
        );
        const now = new Date();
        if (now < contest.startsAt || now >= contest.endsAt)
          throw new BadRequestException("Contest is not accepting submissions");
        if (
          contest.allowedLanguages &&
          !contest.allowedLanguages.includes(body.languageCode)
        )
          throw new BadRequestException(
            "Language is not allowed in this contest",
          );
        const [problem] = await tx
          .select()
          .from(problemsTable)
          .where(
            and(
              eq(problemsTable.id, problemId),
              eq(problemsTable.contestId, contestId),
            ),
          );
        if (!problem) throw new BadRequestException("Problem not found");
        const [testCase] = await tx
          .select({ id: testCasesTable.id })
          .from(testCasesTable)
          .where(eq(testCasesTable.problemId, problemId))
          .limit(1);
        if (!testCase)
          throw new BadRequestException("This problem has no test cases");
        const [created] = await tx
          .insert(submissionsTable)
          .values({
            ...body,
            problemId,
            submittedByUserId: user.id,
            teamId: participant!.teamId,
            status: "queued",
            submittedAt: now,
          })
          .returning({ id: submissionsTable.id });
        return created!;
      });
      try {
        await enqueueSubmission(submission.id);
      } catch {
        console.error(
          "Submission recorded; queue recovery will enqueue",
          submission.id,
        );
      }
      return c.json(
        {
          id: submission.id,
          status: "queued" as const,
          message: "Submission created successfully",
        },
        201,
      );
    },
  )
  .get(
    "/",
    enforceAuthMiddleware(),
    params,
    zValidator("query", paginationSchema),
    async (c) => {
      const { contestId, problemId } = c.req.valid("param");
      const { participant } = await requireContestAccess(c, contestId);
      const [problem] = await db
        .select()
        .from(problemsTable)
        .where(
          and(
            eq(problemsTable.id, problemId),
            eq(problemsTable.contestId, contestId),
          ),
        );
      if (!problem) throw new BadRequestException("Problem not found");
      return c.json(
        await listSubmissions(
          c,
          contestId,
          participant,
          c.req.valid("query"),
          problemId,
        ),
      );
    },
  );
export default app;

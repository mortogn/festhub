import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@festhub/db";
import {
  problemsTable,
  submissionsTable,
  testCasesTable,
} from "@festhub/db/schema";
import { createProblemSchema } from "@festhub/shared/validation";
import { and, eq, max } from "drizzle-orm";
import type { AppVars } from "../../types/variables.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { requireContestAccess, requireEditableContest } from "./access.js";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import {
  requirePublishableContest,
  validateProblemLimits,
} from "./authoring.js";

const params = zValidator("param", z.object({ contestId: z.uuid() }));
const app = new Hono<AppVars>()
  .post(
    "/",
    enforceAuthMiddleware(["teacher", "admin"]),
    params,
    zValidator("json", createProblemSchema),
    async (c) => {
      const { contestId } = c.req.valid("param");
      const body = c.req.valid("json");
      await validateProblemLimits(body.cpuLimit, body.memoryLimit);
      const problem = await db.transaction(async (tx) => {
        const { contest } = await requireContestAccess(c, contestId, {
          dbClient: tx,
          lock: true,
        });
        requireEditableContest(contest);
        if (contest.isActive)
          throw new BadRequestException(
            "Unpublish the contest before adding a problem",
          );
        const [last] = await tx
          .select({ position: max(problemsTable.position) })
          .from(problemsTable)
          .where(eq(problemsTable.contestId, contestId));
        const [created] = await tx
          .insert(problemsTable)
          .values({
            title: body.title,
            statement: body.statement,
            cpuLimitInSeconds: body.cpuLimit,
            memoryLimitInKilobytes: body.memoryLimit,
            contestId,
            position: (last?.position ?? 0) + 1,
          })
          .returning({ id: problemsTable.id });
        return created!;
      });
      return c.json(
        { ...problem, message: "Problem created successfully" },
        201,
      );
    },
  )
  .put(
    "/:problemId",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("param", z.object({ contestId: z.uuid(), problemId: z.uuid() })),
    zValidator("json", createProblemSchema),
    async (c) => {
      const { contestId, problemId } = c.req.valid("param");
      const body = c.req.valid("json");
      await validateProblemLimits(body.cpuLimit, body.memoryLimit);
      await db.transaction(async (tx) => {
        const { contest } = await requireContestAccess(c, contestId, {
          dbClient: tx,
          lock: true,
        });
        requireEditableContest(contest);
        const updated = await tx
          .update(problemsTable)
          .set({
            title: body.title,
            statement: body.statement,
            cpuLimitInSeconds: body.cpuLimit,
            memoryLimitInKilobytes: body.memoryLimit,
          })
          .where(
            and(
              eq(problemsTable.id, problemId),
              eq(problemsTable.contestId, contestId),
            ),
          )
          .returning({ id: problemsTable.id });
        if (!updated.length) throw new BadRequestException("Problem not found");
      });
      return c.json({ message: "Problem updated successfully" });
    },
  )
  .delete(
    "/:problemId",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("param", z.object({ contestId: z.uuid(), problemId: z.uuid() })),
    async (c) => {
      const { contestId, problemId } = c.req.valid("param");
      await db.transaction(async (tx) => {
        const { contest } = await requireContestAccess(c, contestId, {
          dbClient: tx,
          lock: true,
        });
        requireEditableContest(contest);
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
        if (
          await tx.$count(
            submissionsTable,
            eq(submissionsTable.problemId, problemId),
          )
        )
          throw new BadRequestException(
            "A problem with submissions cannot be deleted",
          );
        await tx
          .delete(testCasesTable)
          .where(eq(testCasesTable.problemId, problemId));
        await tx.delete(problemsTable).where(eq(problemsTable.id, problemId));
        if (contest.isActive) await requirePublishableContest(tx, contestId);
      });
      return c.json({ message: "Problem deleted successfully" });
    },
  )
  .get("/", enforceAuthMiddleware(), params, async (c) => {
    const { contestId } = c.req.valid("param");
    await requireContestAccess(c, contestId);
    const problems = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.contestId, contestId))
      .orderBy(problemsTable.position);
    return c.json({ problems });
  });
export default app;

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@festhub/db";
import { problemsTable } from "@festhub/db/schema";
import { createProblemSchema } from "@festhub/shared/validation";
import { eq, max } from "drizzle-orm";
import type { AppVars } from "../../types/variables.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { requireContestAccess, requireEditableContest } from "./access.js";
import { getJudgeLimits } from "./_helper.js";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";

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
      const limits = await getJudgeLimits();
      if (
        body.cpuLimit > limits.max_cpu_time_limit ||
        body.memoryLimit > limits.max_memory_limit
      )
        throw new BadRequestException(
          "Problem limits exceed the judge's CPU or memory limits",
        );
      const problem = await db.transaction(async (tx) => {
        const { contest } = await requireContestAccess(c, contestId, {
          dbClient: tx,
          lock: true,
        });
        requireEditableContest(contest);
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

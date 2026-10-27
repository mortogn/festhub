import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@festhub/db";
import { problemsTable, testCasesTable } from "@festhub/db/schema";
import { createTestCaseSchema } from "@festhub/shared/validation";
import { and, eq } from "drizzle-orm";
import type { AppVars } from "../../types/variables.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import {
  requireContestAccess,
  requireEditableContest,
  isStaff,
} from "./access.js";

const params = zValidator(
  "param",
  z.object({ contestId: z.uuid(), problemId: z.uuid() }),
);
const app = new Hono<AppVars>()
  .post(
    "/",
    enforceAuthMiddleware(["teacher", "admin"]),
    params,
    zValidator("json", createTestCaseSchema),
    async (c) => {
      const { contestId, problemId } = c.req.valid("param");
      const body = c.req.valid("json");
      const created = await db.transaction(async (tx) => {
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
        const [conflict] = await tx
          .select()
          .from(testCasesTable)
          .where(
            and(
              eq(testCasesTable.problemId, problemId),
              eq(testCasesTable.position, body.position),
            ),
          );
        if (conflict)
          throw new BadRequestException("Test case position already exists");
        const [testCase] = await tx
          .insert(testCasesTable)
          .values({ ...body, problemId })
          .returning({ id: testCasesTable.id });
        return testCase!;
      });
      return c.json(
        { ...created, message: "Test case created successfully" },
        201,
      );
    },
  )
  .get("/", enforceAuthMiddleware(), params, async (c) => {
    const { contestId, problemId } = c.req.valid("param");
    await requireContestAccess(c, contestId);
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
    const testCases = await db
      .select()
      .from(testCasesTable)
      .where(
        and(
          eq(testCasesTable.problemId, problemId),
          ...(!isStaff(c) ? [eq(testCasesTable.isSample, true)] : []),
        ),
      )
      .orderBy(testCasesTable.position);
    return c.json({ testCases });
  });
export default app;

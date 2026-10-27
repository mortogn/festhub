import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { createTestCaseSchema } from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  contestsTable,
  eventsTable,
  participantsTable,
  problemsTable,
  testCasesTable,
} from "@festhub/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { AppVars } from "../../types/variables.js";
import { ForbiddenException } from "../../exceptions/forbidden-exception.js";
import { throwOnNotAParticipant } from "./_helper.js";

const problemTestCasesParam = zValidator(
  "param",
  z.object({
    problemId: z.uuid(),
    contestId: z.uuid(),
  }),
);

export const app = new Hono<AppVars>()
  .post(
    "/",
    enforceAuthMiddleware(["teacher", "admin"]),
    problemTestCasesParam,
    zValidator("json", createTestCaseSchema),
    async (c) => {
      const { problemId, contestId } = c.req.valid("param");
      const body = c.req.valid("json");

      await db.transaction(async (tx) => {
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

        const [positionConflict] = await tx
          .select()
          .from(testCasesTable)
          .where(
            and(
              eq(testCasesTable.problemId, problemId),
              eq(testCasesTable.position, body.position),
            ),
          );

        if (positionConflict)
          throw new BadRequestException(
            `Test case position ${positionConflict.position} already exists for this problem`,
          );

        await tx.insert(testCasesTable).values({
          ...body,
          problemId,
        });
      });

      return c.json({ message: "Test case created successfully" }, 201);
    },
  )
  .get("/", enforceAuthMiddleware(), problemTestCasesParam, async (c) => {
    const { problemId, contestId } = c.req.valid("param");

    const user = c.var.user;

    let whereClauses = [
      eq(testCasesTable.problemId, problemId),
      eq(contestsTable.id, contestId),
    ];

    if (!["teacher", "admin"].includes(user.role)) {
      await throwOnNotAParticipant({ studentId: user.id, contestId });

      whereClauses.push(eq(testCasesTable.isSample, true));
      whereClauses.push(eq(contestsTable.isActive, true));
    }

    const rows = await db
      .select({
        testCases: testCasesTable,
      })
      .from(testCasesTable)
      .innerJoin(problemsTable, eq(problemsTable.id, testCasesTable.problemId))
      .innerJoin(contestsTable, eq(contestsTable.id, problemsTable.contestId))
      .where(and(...whereClauses));

    return c.json({ testCases: rows.map((row) => row.testCases) });
  });

export default app;

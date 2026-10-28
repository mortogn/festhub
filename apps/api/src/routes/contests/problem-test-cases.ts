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
import { ForbiddenException } from "../../exceptions/forbidden-exception.js";
import {
  isStaff,
  requireEditableContest,
  requireOfficialContestAccess,
  type ContestAccessCheck,
} from "./access.js";
import { requirePublishableContest } from "./authoring.js";

const params = zValidator(
  "param",
  z.object({ contestId: z.uuid(), problemId: z.uuid() }),
);

type TestCaseRouteOptions = {
  practice?: boolean;
  problemSetsOnly?: boolean;
};

export function createProblemTestCasesRoute(
  access: ContestAccessCheck,
  options: TestCaseRouteOptions = {},
) {
  return new Hono<AppVars>()
    .post(
      "/",
      enforceAuthMiddleware(["teacher", "admin"]),
      params,
      zValidator("json", createTestCaseSchema),
      async (c) => {
        const { contestId, problemId } = c.req.valid("param");
        const body = c.req.valid("json");
        const created = await db.transaction(async (tx) => {
          const { contest } = await access(c, contestId, {
            dbClient: tx,
            lock: true,
          });
          if (options.problemSetsOnly && contest.kind !== "problem_set")
            throw new ForbiddenException(
              "Practice test cases can only be edited in problem sets",
            );
          requireEditableContest(contest, options.practice);
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
    .put(
      "/:testCaseId",
      enforceAuthMiddleware(["teacher", "admin"]),
      zValidator(
        "param",
        z.object({
          contestId: z.uuid(),
          problemId: z.uuid(),
          testCaseId: z.uuid(),
        }),
      ),
      zValidator("json", createTestCaseSchema),
      async (c) => {
        const { contestId, problemId, testCaseId } = c.req.valid("param");
        const body = c.req.valid("json");
        await db.transaction(async (tx) => {
          const { contest } = await access(c, contestId, {
            dbClient: tx,
            lock: true,
          });
          if (options.problemSetsOnly && contest.kind !== "problem_set")
            throw new ForbiddenException(
              "Practice test cases can only be edited in problem sets",
            );
          requireEditableContest(contest, options.practice);
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
          if (conflict && conflict.id !== testCaseId)
            throw new BadRequestException("Test case position already exists");
          const updated = await tx
            .update(testCasesTable)
            .set(body)
            .where(
              and(
                eq(testCasesTable.id, testCaseId),
                eq(testCasesTable.problemId, problemId),
              ),
            )
            .returning({ id: testCasesTable.id });
          if (!updated.length)
            throw new BadRequestException("Test case not found");
        });
        return c.json({ message: "Test case updated successfully" });
      },
    )
    .delete(
      "/:testCaseId",
      enforceAuthMiddleware(["teacher", "admin"]),
      zValidator(
        "param",
        z.object({
          contestId: z.uuid(),
          problemId: z.uuid(),
          testCaseId: z.uuid(),
        }),
      ),
      async (c) => {
        const { contestId, problemId, testCaseId } = c.req.valid("param");
        await db.transaction(async (tx) => {
          const { contest } = await access(c, contestId, {
            dbClient: tx,
            lock: true,
          });
          if (options.problemSetsOnly && contest.kind !== "problem_set")
            throw new ForbiddenException(
              "Practice test cases can only be edited in problem sets",
            );
          requireEditableContest(contest, options.practice);
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
          const removed = await tx
            .delete(testCasesTable)
            .where(
              and(
                eq(testCasesTable.id, testCaseId),
                eq(testCasesTable.problemId, problemId),
              ),
            )
            .returning({ id: testCasesTable.id });
          if (!removed.length)
            throw new BadRequestException("Test case not found");
          if (contest.isActive) await requirePublishableContest(tx, contestId);
        });
        return c.json({ message: "Test case deleted successfully" });
      },
    )
    .get("/", enforceAuthMiddleware(), params, async (c) => {
      const { contestId, problemId } = c.req.valid("param");
      await access(c, contestId);
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
}

export default createProblemTestCasesRoute(requireOfficialContestAccess);

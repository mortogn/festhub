import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@festhub/db";
import {
  problemsTable,
  submissionsTable,
  submissionTestCaseResultsTable,
  testCasesTable,
} from "@festhub/db/schema";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { AppVars } from "../../types/variables.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { NotFoundException } from "../../exceptions/not-found-exception.js";
import {
  isStaff,
  requireOfficialContestAccess,
  type ContestAccessCheck,
  type Participant,
} from "./access.js";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
function visibility<E extends AppVars>(
  c: Context<E>,
  participant: Participant,
): SQL[] {
  if (isStaff(c)) return [];
  const user = c.var.user;
  if (!user.authenticated) throw new NotFoundException();
  return [
    participant?.teamId
      ? eq(submissionsTable.teamId, participant.teamId)
      : eq(submissionsTable.submittedByUserId, user.id),
  ];
}
const summary = {
  id: submissionsTable.id,
  problemId: submissionsTable.problemId,
  languageCode: submissionsTable.languageCode,
  submittedAt: submissionsTable.submittedAt,
  status: submissionsTable.status,
  verdict: submissionsTable.verdict,
  startedAt: submissionsTable.startedAt,
  finishedAt: submissionsTable.finishedAt,
};
export async function listSubmissions<E extends AppVars>(
  c: Context<E>,
  contestId: string,
  participant: Participant,
  pagination: z.infer<typeof paginationSchema>,
  problemId?: string,
) {
  const where = and(
    eq(problemsTable.contestId, contestId),
    ...visibility(c, participant),
    ...(problemId ? [eq(submissionsTable.problemId, problemId)] : []),
  );
  const rows = await db
    .select(summary)
    .from(submissionsTable)
    .innerJoin(problemsTable, eq(problemsTable.id, submissionsTable.problemId))
    .where(where)
    .orderBy(desc(submissionsTable.submittedAt), desc(submissionsTable.id))
    .limit(pagination.limit + 1)
    .offset((pagination.page - 1) * pagination.limit);
  return {
    submissions: rows.slice(0, pagination.limit),
    page: pagination.page,
    hasMore: rows.length > pagination.limit,
  };
}

export function createSubmissionsRoute(access: ContestAccessCheck) {
  return new Hono<AppVars>()
    .use("*", enforceAuthMiddleware())
    .get(
      "/",
      zValidator("param", z.object({ contestId: z.uuid() })),
      zValidator("query", paginationSchema),
      async (c) => {
        const { contestId } = c.req.valid("param");
        const { participant } = await access(c, contestId);
        return c.json(
          await listSubmissions(
            c,
            contestId,
            participant,
            c.req.valid("query"),
          ),
        );
      },
    )
    .get(
      "/:submissionId",
      zValidator(
        "param",
        z.object({ contestId: z.uuid(), submissionId: z.uuid() }),
      ),
      async (c) => {
        const { contestId, submissionId } = c.req.valid("param");
        const { participant } = await access(c, contestId);
        const [submission] = await db
          .select({ ...summary, sourceCode: submissionsTable.sourceCode })
          .from(submissionsTable)
          .innerJoin(
            problemsTable,
            eq(problemsTable.id, submissionsTable.problemId),
          )
          .where(
            and(
              eq(problemsTable.contestId, contestId),
              eq(submissionsTable.id, submissionId),
              ...visibility(c, participant),
            ),
          );
        if (!submission) throw new NotFoundException("Submission not found");
        const [metrics] = await db
          .select({
            judged: sql<number>`count(*) filter (where ${submissionTestCaseResultsTable.verdict} is not null)::int`,
            passed: sql<number>`count(*) filter (where ${submissionTestCaseResultsTable.verdict} = 'AC')::int`,
            executionTime: sql<
              number | null
            >`max(${submissionTestCaseResultsTable.executionTime})`,
            memoryUsed: sql<
              number | null
            >`max(${submissionTestCaseResultsTable.memoryUsed})`,
          })
          .from(submissionTestCaseResultsTable)
          .where(eq(submissionTestCaseResultsTable.submissionId, submissionId));
        const total = await db.$count(
          testCasesTable,
          eq(testCasesTable.problemId, submission.problemId),
        );
        const [compiler] = await db
          .select({ output: submissionTestCaseResultsTable.compileOutput })
          .from(submissionTestCaseResultsTable)
          .where(
            and(
              eq(submissionTestCaseResultsTable.submissionId, submissionId),
              eq(submissionTestCaseResultsTable.verdict, "CE"),
            ),
          )
          .limit(1);
        return c.json({
          ...submission,
          ...metrics!,
          total,
          compileOutput: compiler?.output ?? null,
        });
      },
    );
}

export default createSubmissionsRoute(requireOfficialContestAccess);

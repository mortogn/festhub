import { db } from "@festhub/db";
import {
  problemsTable,
  submissionsTable,
  submissionTestCaseResultsTable,
  testCasesTable,
} from "@festhub/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { SubmissionStore } from "./processor.js";

const caseWhere = (submissionId: string, testCaseId: string) =>
  and(
    eq(submissionTestCaseResultsTable.submissionId, submissionId),
    eq(submissionTestCaseResultsTable.testCaseId, testCaseId),
  );
export const store: SubmissionStore = {
  async load(id) {
    const [row] = await db
      .select({ submission: submissionsTable, problem: problemsTable })
      .from(submissionsTable)
      .innerJoin(
        problemsTable,
        eq(problemsTable.id, submissionsTable.problemId),
      )
      .where(eq(submissionsTable.id, id));
    if (!row) return null;
    const testCases = await db
      .select()
      .from(testCasesTable)
      .where(eq(testCasesTable.problemId, row.problem.id))
      .orderBy(testCasesTable.position);
    return {
      submission: row.submission,
      cpuLimit: row.problem.cpuLimitInSeconds,
      memoryLimit: row.problem.memoryLimitInKilobytes,
      testCases,
    };
  },
  async start(id) {
    await db
      .update(submissionsTable)
      .set({
        status: "processing",
        startedAt: sql`coalesce(${submissionsTable.startedAt}, now())`,
        errorMessage: null,
      })
      .where(
        and(
          eq(submissionsTable.id, id),
          inArray(submissionsTable.status, ["queued", "processing"]),
        ),
      );
  },
  async getCase(submissionId, testCaseId) {
    const [result] = await db
      .select()
      .from(submissionTestCaseResultsTable)
      .where(caseWhere(submissionId, testCaseId));
    return result ?? null;
  },
  async saveToken(submissionId, testCaseId, token) {
    await db
      .insert(submissionTestCaseResultsTable)
      .values({ submissionId, testCaseId, judge0Token: token })
      .onConflictDoNothing({
        target: [
          submissionTestCaseResultsTable.submissionId,
          submissionTestCaseResultsTable.testCaseId,
        ],
      });
    const [saved] = await db
      .select({ token: submissionTestCaseResultsTable.judge0Token })
      .from(submissionTestCaseResultsTable)
      .where(caseWhere(submissionId, testCaseId));
    if (!saved?.token) throw new Error("Could not persist Judge0 token");
    return saved.token;
  },
  async saveResult(submissionId, testCaseId, result) {
    await db
      .update(submissionTestCaseResultsTable)
      .set({ ...result, finishedAt: new Date() })
      .where(caseWhere(submissionId, testCaseId));
  },
  async complete(id, verdict) {
    await db
      .update(submissionsTable)
      .set({
        status: "completed",
        verdict,
        finishedAt: new Date(),
        errorMessage: null,
      })
      .where(
        and(
          eq(submissionsTable.id, id),
          inArray(submissionsTable.status, ["queued", "processing"]),
        ),
      );
  },
};
export async function markError(id: string, message: string) {
  await db
    .update(submissionsTable)
    .set({
      status: "error",
      verdict: null,
      errorMessage: message.slice(0, 2000),
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(submissionsTable.id, id),
        inArray(submissionsTable.status, ["queued", "processing"]),
      ),
    );
}

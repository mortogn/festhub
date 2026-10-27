import type { DBClient } from "@festhub/db";
import { problemsTable, testCasesTable } from "@festhub/db/schema";
import { eq, sql } from "drizzle-orm";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { getJudgeLanguages, getJudgeLimits } from "./_helper.js";

export async function validateLanguages(ids?: number[] | null) {
  if (!ids) return;
  const languages = await getJudgeLanguages();
  if (ids.some((id) => !languages.some((language) => language.id === id)))
    throw new BadRequestException("Select languages supported by the judge");
}

export async function validateProblemLimits(cpu: number, memory: number) {
  const limits = await getJudgeLimits();
  if (cpu > limits.max_cpu_time_limit || memory > limits.max_memory_limit)
    throw new BadRequestException(
      "Problem limits exceed the judge's CPU or memory limits",
    );
}

// The caller holds the contest row lock, also used by every content mutation.
export async function requirePublishableContest(
  tx: DBClient,
  contestId: string,
) {
  const problems = await tx
    .select({
      id: problemsTable.id,
      count: sql<number>`count(${testCasesTable.id})::int`,
    })
    .from(problemsTable)
    .leftJoin(testCasesTable, eq(testCasesTable.problemId, problemsTable.id))
    .where(eq(problemsTable.contestId, contestId))
    .groupBy(problemsTable.id);
  if (!problems.length || problems.some((problem) => problem.count === 0))
    throw new BadRequestException(
      "Add at least one problem and a test case for every problem before publishing",
    );
}

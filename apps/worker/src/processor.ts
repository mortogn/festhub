import type { Verdict } from "@festhub/shared/contest";
import type { JudgeClient, JudgeResult } from "./judge.js";

export type Submission = {
  id: string;
  sourceCode: string;
  languageCode: number;
  status: string;
};
export type TestCase = {
  id: string;
  stdin: string;
  stdout: string;
  position: number;
};
export type CaseResult = {
  judge0Token: string | null;
  verdict: Verdict | null;
};
export interface SubmissionStore {
  load(
    id: string,
  ): Promise<{
    submission: Submission;
    cpuLimit: number;
    memoryLimit: number;
    testCases: TestCase[];
  } | null>;
  start(id: string): Promise<void>;
  getCase(submissionId: string, testCaseId: string): Promise<CaseResult | null>;
  saveToken(
    submissionId: string,
    testCaseId: string,
    token: string,
  ): Promise<string>;
  saveResult(
    submissionId: string,
    testCaseId: string,
    result: JudgeResult,
  ): Promise<void>;
  complete(id: string, verdict: Verdict): Promise<void>;
}

export async function processSubmission(
  id: string,
  store: SubmissionStore,
  judge: Pick<JudgeClient, "create" | "result">,
) {
  const data = await store.load(id);
  if (!data || ["completed", "error"].includes(data.submission.status)) return;
  if (!data.testCases.length) throw new Error("Problem has no test cases");
  await store.start(id);
  for (const testCase of [...data.testCases].sort(
    (a, b) => a.position - b.position,
  )) {
    const previous = await store.getCase(id, testCase.id);
    let verdict = previous?.verdict;
    if (!verdict) {
      let token = previous?.judge0Token;
      if (!token) {
        token = await judge.create({
          sourceCode: data.submission.sourceCode,
          languageCode: data.submission.languageCode,
          stdin: testCase.stdin,
          cpuLimit: data.cpuLimit,
          memoryLimit: data.memoryLimit,
        });
        token = await store.saveToken(id, testCase.id, token);
      }
      const result = await judge.result(token, testCase.stdout);
      await store.saveResult(id, testCase.id, result);
      verdict = result.verdict;
    }
    if (verdict !== "AC") {
      await store.complete(id, verdict);
      return;
    }
  }
  await store.complete(id, "AC");
}

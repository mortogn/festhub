import client, { readResponse } from "@festhub/frontend/api";
export { client, readResponse };
export const loadContests = async () =>
  readResponse(await client.contests.$get());
export const loadContest = async (slug: string) =>
  readResponse(
    await client.contests["by-slug"][":slug"].$get({ param: { slug } }),
  );
export const loadProblems = async (contestId: string) =>
  readResponse(
    await client.contests[":contestId"].problems.$get({ param: { contestId } }),
  );
export const loadSamples = async (contestId: string, problemId: string) =>
  readResponse(
    await client.contests[":contestId"].problems[":problemId"].testcases.$get({
      param: { contestId, problemId },
    }),
  );
export const loadLanguages = async () =>
  readResponse(await client.contests.languages.$get());
export const loadSubmissions = async (contestId: string, page: number) =>
  readResponse(
    await client.contests[":contestId"].submissions.$get({
      param: { contestId },
      query: { page: String(page), limit: "20" },
    }),
  );
export const loadSubmission = async (contestId: string, submissionId: string) =>
  readResponse(
    await client.contests[":contestId"].submissions[":submissionId"].$get({
      param: { contestId, submissionId },
    }),
  );
export const loadStandings = async (contestId: string) =>
  readResponse(
    await client.contests[":contestId"].standings.$get({
      param: { contestId },
    }),
  );
export const loadPractice = async () =>
  readResponse(await client.practice.$get());
export const loadPracticeBySlug = async (slug: string) =>
  readResponse(
    await client.practice["by-slug"][":slug"].$get({ param: { slug } }),
  );
export const loadPracticeProblems = async (contestId: string) =>
  readResponse(
    await client.practice[":contestId"].problems.$get({
      param: { contestId },
    }),
  );
export const loadPracticeSamples = async (
  contestId: string,
  problemId: string,
) =>
  readResponse(
    await client.practice[":contestId"].problems[":problemId"].testcases.$get({
      param: { contestId, problemId },
    }),
  );
export const loadPracticeSubmissions = async (
  contestId: string,
  page: number,
) =>
  readResponse(
    await client.practice[":contestId"].submissions.$get({
      param: { contestId },
      query: { page: String(page), limit: "20" },
    }),
  );
export const loadPracticeSubmission = async (
  contestId: string,
  submissionId: string,
) =>
  readResponse(
    await client.practice[":contestId"].submissions[":submissionId"].$get({
      param: { contestId, submissionId },
    }),
  );
export type Contest = Awaited<ReturnType<typeof loadContest>>;
export type Problem = Awaited<
  ReturnType<typeof loadProblems>
>["problems"][number];
export type Practice = Awaited<ReturnType<typeof loadPractice>>;
export type PracticeContest = (
  | Practice["problemSets"][number]
  | Practice["pastContests"][number]
) & { problemCount?: number; solvedCount?: number };
export type PracticeProblem = Awaited<
  ReturnType<typeof loadPracticeProblems>
>["problems"][number];
export type SubmissionDetail = Awaited<ReturnType<typeof loadSubmission>>;
export type Standings = Awaited<ReturnType<typeof loadStandings>>;

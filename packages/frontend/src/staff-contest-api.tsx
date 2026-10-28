import client, { ApiError, readResponse } from "./api";

export type StaffTestCase = {
  id: string;
  problemId: string;
  stdin: string;
  stdout: string;
  position: number;
  isSample: boolean | null;
  createdAt?: string | Date | null;
};
export type StaffProblem = {
  id: string;
  contestId: string;
  position: number;
  title: string;
  statement: string;
  memoryLimitInKilobytes: number;
  cpuLimitInSeconds: number;
  solved?: boolean;
  attempts?: number;
  testCases: StaffTestCase[];
};
export type StaffContest = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "official" | "problem_set";
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  eventId: string | null;
  allowedLanguages: number[] | null;
  isActive: boolean;
  hasPassword: boolean;
  isLocked: boolean;
  createdAt?: string | Date;
  problemCount?: number;
  solvedCount?: number;
};

export const loadStaffContests = async () =>
  readResponse(await client.contests.$get());
export const loadStaffPractice = async () =>
  readResponse(await client.practice.$get());
export const loadContestEvents = async () =>
  readResponse(await client.events.$get());
export const loadContestLanguages = async () =>
  readResponse(await client.contests.languages.$get());
export const loadContestLimits = async () =>
  readResponse(await client.contests.limits.$get());
export const contestHref = (id: string) => `/dashboard/contests/${id}`;

export type StaffContestEvent = {
  id: string;
  title: string;
  teamBased: boolean;
  startsAt: string | Date;
  endsAt: string | Date;
  isActive: boolean;
};
export type ContestEditor = {
  contest: StaffContest;
  event: StaffContestEvent | null;
  problems: StaffProblem[];
  practice: boolean;
};

async function loadProblems(
  contestId: string,
  practice: boolean,
): Promise<StaffProblem[]> {
  const result = practice
    ? await readResponse(
        await client.practice[":contestId"].problems.$get({
          param: { contestId },
        }),
      )
    : await readResponse(
        await client.contests[":contestId"].problems.$get({
          param: { contestId },
        }),
      );
  return Promise.all(
    result.problems.map(async (problem) => {
      const { testCases } = practice
        ? await readResponse(
            await client.practice[":contestId"].problems[
              ":problemId"
            ].testcases.$get({
              param: { contestId, problemId: problem.id },
            }),
          )
        : await readResponse(
            await client.contests[":contestId"].problems[
              ":problemId"
            ].testcases.$get({
              param: { contestId, problemId: problem.id },
            }),
          );
      return {
        ...problem,
        testCases,
      } as StaffProblem;
    }),
  );
}

export async function loadContestEditor(id: string): Promise<ContestEditor> {
  try {
    const contest = (await readResponse(
      await client.contests[":id"].$get({ param: { id } }),
    )) as StaffContest;
    const [event, problems] = await Promise.all([
      contest.eventId
        ? readResponse(
            await client.events[":id"].$get({ param: { id: contest.eventId } }),
          )
        : Promise.resolve(null),
      loadProblems(id, false),
    ]);
    return { contest, event, problems, practice: false };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    const contest = (await readResponse(
      await client.practice[":id"].$get({ param: { id } }),
    )) as StaffContest;
    const problems = await loadProblems(id, true);
    return { contest, event: null, problems, practice: true };
  }
}

export { problemLabel };

function problemLabel(position: number) {
  let label = "";
  for (let value = position; value > 0; value = Math.floor((value - 1) / 26))
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  return label;
}

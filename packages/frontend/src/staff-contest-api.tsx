import client, { readResponse } from "./api";

export const loadStaffContests = async () =>
  readResponse(await client.contests.$get());
export const loadContestEvents = async () =>
  readResponse(await client.events.$get());
export const loadContestLanguages = async () =>
  readResponse(await client.contests.languages.$get());
export const loadContestLimits = async () =>
  readResponse(await client.contests.limits.$get());
export const contestHref = (id: string) => `/dashboard/contests/${id}`;

export async function loadContestEditor(id: string) {
  const [contest, result] = await Promise.all([
    readResponse(await client.contests[":id"].$get({ param: { id } })),
    readResponse(
      await client.contests[":contestId"].problems.$get({
        param: { contestId: id },
      }),
    ),
  ]);
  const [event, problems] = await Promise.all([
    readResponse(
      await client.events[":id"].$get({ param: { id: contest.eventId } }),
    ),
    Promise.all(
      result.problems.map(async (problem) => {
        const { testCases } = await readResponse(
          await client.contests[":contestId"].problems[
            ":problemId"
          ].testcases.$get({
            param: { contestId: id, problemId: problem.id },
          }),
        );
        return { ...problem, testCases };
      }),
    ),
  ]);
  return { contest, event, problems };
}

export type ContestEditor = Awaited<ReturnType<typeof loadContestEditor>>;
export type StaffContest = ContestEditor["contest"];
export type StaffProblem = ContestEditor["problems"][number];
export type StaffTestCase = StaffProblem["testCases"][number];

export function problemLabel(position: number) {
  let label = "";
  for (let value = position; value > 0; value = Math.floor((value - 1) / 26))
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  return label;
}

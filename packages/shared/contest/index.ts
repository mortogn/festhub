export const SUBMISSION_QUEUE = "contest-submissions";
export const SUBMISSION_CONCURRENCY = 4;
export type SubmissionJob = { submissionId: string };
export type Verdict = "AC" | "WA" | "CE" | "RE" | "TLE" | "MLE";
export type JudgeLimits = {
  max_cpu_time_limit: number;
  max_wall_time_limit: number;
  max_memory_limit: number;
};
export function parseJudgeLimits(value: Record<string, unknown>): JudgeLimits {
  for (const key of [
    "max_cpu_time_limit",
    "max_wall_time_limit",
    "max_memory_limit",
  ]) {
    if (
      typeof value[key] !== "number" ||
      !Number.isFinite(value[key]) ||
      value[key] <= 0
    )
      throw new Error("Judge0 returned invalid execution limits");
  }
  return value as JudgeLimits;
}
export const submissionJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 604800, count: 1000 },
};

export function outputsMatch(actual: string, expected: string) {
  const tokens = (value: string) => value.match(/\S+/g) ?? [];
  const a = tokens(actual);
  const b = tokens(expected);
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

export type StandingSubmission = {
  id: string;
  problemId: string;
  submittedByUserId: string;
  teamId: string | null;
  submittedAt: Date;
  status: string;
  verdict: Verdict | null;
};
export type Competitor = { id: string; name: string };

export function calculateStandings(
  startsAt: Date,
  endsAt: Date,
  teamBased: boolean,
  competitors: Competitor[],
  submissions: StandingSubmission[],
) {
  const rows = new Map(
    competitors.map((entry) => [
      entry.id,
      {
        ...entry,
        rank: 0,
        solved: 0,
        penalty: 0,
        problems: {} as Record<
          string,
          { solved: boolean; wrong: number; minutes: number | null }
        >,
      },
    ]),
  );
  const ordered = [...submissions].sort(
    (a, b) =>
      a.submittedAt.getTime() - b.submittedAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  for (const submission of ordered) {
    if (
      submission.status !== "completed" ||
      !submission.verdict ||
      submission.submittedAt < startsAt ||
      submission.submittedAt >= endsAt
    )
      continue;
    const row = rows.get(
      teamBased ? (submission.teamId ?? "") : submission.submittedByUserId,
    );
    if (!row) continue;
    const result = (row.problems[submission.problemId] ??= {
      solved: false,
      wrong: 0,
      minutes: null,
    });
    if (result.solved) continue;
    if (submission.verdict === "AC") {
      result.solved = true;
      result.minutes = Math.floor(
        (submission.submittedAt.getTime() - startsAt.getTime()) / 60000,
      );
      row.solved++;
      row.penalty += result.minutes + result.wrong * 20;
    } else if (submission.verdict !== "CE") result.wrong++;
  }
  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.solved - a.solved ||
      a.penalty - b.penalty ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  sorted.forEach((row, i) => {
    const previous = sorted[i - 1];
    row.rank =
      previous &&
      previous.solved === row.solved &&
      previous.penalty === row.penalty
        ? previous.rank
        : i + 1;
  });
  return sorted;
}

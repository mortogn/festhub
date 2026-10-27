import assert from "node:assert/strict";
import { test } from "node:test";
import {
  outputsMatch,
  calculateStandings,
  type Verdict,
  type StandingSubmission,
} from "@festhub/shared/contest";
import { JudgeClient, type JudgeResult } from "../src/judge.js";
import {
  processSubmission,
  type CaseResult,
  type SubmissionStore,
} from "../src/processor.js";

test("whitespace comparison preserves exact tokens and handles empty output", () => {
  assert.equal(outputsMatch("  1\r\n2\t", "1 2"), true);
  assert.equal(outputsMatch("", " \n"), true);
  assert.equal(outputsMatch("1.0", "1.00"), false);
  assert.equal(outputsMatch("1 2", "12"), false);
  assert.equal(outputsMatch("1 2", "1"), false);
});

function fixture() {
  const cases = new Map<string, CaseResult>();
  const calls: string[] = [];
  let status = "queued";
  let verdict: Verdict | null = null;
  const store: SubmissionStore = {
    async load(id) {
      return {
        submission: { id, sourceCode: "code", languageCode: 54, status },
        cpuLimit: 2,
        memoryLimit: 131072,
        testCases: [3, 1, 2].map((position) => ({
          id: String(position),
          position,
          stdin: String(position),
          stdout: "ok",
        })),
      };
    },
    async start() {
      status = "processing";
    },
    async getCase(_, id) {
      return cases.get(id) ?? null;
    },
    async saveToken(_, id, token) {
      calls.push(`token:${id}`);
      cases.set(id, { judge0Token: token, verdict: null });
      return token;
    },
    async saveResult(_, id, result) {
      calls.push(`result:${id}`);
      cases.set(id, {
        judge0Token: cases.get(id)!.judge0Token,
        verdict: result.verdict,
      });
    },
    async complete(_, result) {
      status = "completed";
      verdict = result;
    },
  };
  return {
    store,
    calls,
    cases,
    get status() {
      return status;
    },
    get verdict() {
      return verdict;
    },
  };
}
const result = (verdict: Verdict): JudgeResult => ({
  verdict,
  executionTime: 0.01,
  memoryUsed: 123,
  compileOutput: null,
});

for (const failure of ["WA", "CE", "RE", "TLE"] as Verdict[]) {
  test(`stops sequential judging at the first ${failure}`, async () => {
    const f = fixture();
    await processSubmission("s", f.store, {
      async create(input) {
        f.calls.push(`create:${input.stdin}`);
        return input.stdin;
      },
      async result(token) {
        f.calls.push(`poll:${token}`);
        return result(failure);
      },
    });
    assert.deepEqual(f.calls, ["create:1", "token:1", "poll:1", "result:1"]);
    assert.equal(f.verdict, failure);
    assert.equal(f.cases.size, 1);
  });
}

test("all cases pass in position order and completed delivery does no work", async () => {
  const f = fixture();
  const judge = {
    async create(input: { stdin: string }) {
      return input.stdin;
    },
    async result() {
      return result("AC");
    },
  };
  await processSubmission("s", f.store, judge);
  assert.deepEqual([...f.cases.keys()], ["1", "2", "3"]);
  assert.equal(f.verdict, "AC");
  const calls = [...f.calls];
  await processSubmission("s", f.store, judge);
  assert.deepEqual(f.calls, calls);
});

test("restart resumes saved results and token after a polling failure", async () => {
  const f = fixture();
  f.cases.set("1", { judge0Token: "old", verdict: "AC" });
  let creates = 0;
  const create = async (input: { stdin: string }) => {
    creates++;
    return input.stdin;
  };
  await assert.rejects(
    processSubmission("s", f.store, {
      create,
      async result() {
        throw new Error("offline");
      },
    }),
    /offline/,
  );
  assert.equal(f.status, "processing");
  await processSubmission("s", f.store, {
    create,
    async result() {
      return result("AC");
    },
  });
  assert.equal(creates, 2); // Case 2 is reused; only case 3 is newly created after restart.
  assert.equal(f.verdict, "AC");
});

test("Judge0 client authenticates, disables networking, encodes UTF-8, and polls", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  let polls = 0;
  const request: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init: init! });
    if (String(url).endsWith("/config_info"))
      return Response.json({
        max_cpu_time_limit: 15,
        max_wall_time_limit: 20,
        max_memory_limit: 512000,
      });
    if (init?.method === "POST") return Response.json({ token: "saved-token" });
    return Response.json(
      ++polls === 1
        ? { status: { id: 2 } }
        : {
            status: { id: 3 },
            stdout: Buffer.from("হ্যালো\n2").toString("base64"),
            time: "0.02",
            memory: 1024,
          },
    );
  };
  const judge = new JudgeClient(
    "https://judge.test/",
    "test-secret",
    request,
    0,
  );
  const token = await judge.create({
    sourceCode: "print('হ্যালো')",
    languageCode: 71,
    stdin: "input",
    cpuLimit: 15,
    memoryLimit: 131072,
  });
  assert.equal(token, "saved-token");
  const body = JSON.parse(
    requests.find((entry) => entry.init.method === "POST")!.init.body as string,
  );
  assert.equal(body.wall_time_limit, 20);
  assert.equal(body.enable_network, false);
  assert.equal(body.expected_output, undefined);
  assert.equal(body.memory_limit, 131072);
  assert.equal(
    Buffer.from(body.source_code, "base64").toString(),
    "print('হ্যালো')",
  );
  assert.equal(
    (requests[0]!.init.headers as Record<string, string>)["X-Auth-Token"],
    "test-secret",
  );
  assert.equal((await judge.result(token, "হ্যালো 2")).verdict, "AC");
  assert.equal(polls, 2);
});

test("Judge0 internal errors and timeouts never turn into contestant WA", async () => {
  const judge = new JudgeClient("https://judge.test", "secret", async () =>
    Response.json({ status: { id: 13 } }),
  );
  await assert.rejects(judge.result("token", "expected"), /infrastructure/);
  const timedOut = new JudgeClient(
    "https://judge.test",
    "secret",
    async () => Response.json({ status: { id: 1 } }),
    0,
    1,
  );
  await assert.rejects(timedOut.result("token", "expected"), /timed out/);
});

test("ICPC scoring groups teams, excludes CE/errors/post-AC attempts, and shares tied ranks", () => {
  const start = new Date("2026-10-28T00:00:00Z");
  const end = new Date(start.getTime() + 3600000);
  let index = 0;
  const s = (
    minutes: number,
    verdict: Verdict | null,
    teamId = "team",
    problemId = "p",
    status = "completed",
  ): StandingSubmission => ({
    id: String(index++),
    problemId,
    submittedByUserId: `user-${index}`,
    teamId,
    submittedAt: new Date(start.getTime() + minutes * 60000),
    status,
    verdict,
  });
  const standings = calculateStandings(
    start,
    end,
    true,
    [
      { id: "team", name: "Team" },
      { id: "other", name: "Other" },
    ],
    [
      s(2, "CE"),
      s(3, null, "team", "p", "error"),
      s(4, "WA"),
      s(10, "AC"),
      s(11, "WA"),
      s(12, "AC"),
      s(30, "AC", "other"),
      s(20, "WA", "team", "unsolved"),
      s(60, "AC", "team", "late"),
    ].reverse(),
  );
  assert.deepEqual(
    standings.map((row) => [row.solved, row.penalty, row.rank]),
    [
      [1, 30, 1],
      [1, 30, 1],
    ],
  );
  assert.equal(
    standings.find((row) => row.id === "team")!.problems.p!.wrong,
    1,
  );
});

test("individual scores use user identity rather than a stray team ID", () => {
  const start = new Date(0);
  const rows = calculateStandings(
    start,
    new Date(3600000),
    false,
    [{ id: "student", name: "Student" }],
    [
      {
        id: "s",
        problemId: "p",
        submittedByUserId: "student",
        teamId: "irrelevant",
        submittedAt: new Date(60000),
        status: "completed",
        verdict: "AC",
      },
    ],
  );
  assert.equal(rows[0]!.solved, 1);
  assert.equal(rows[0]!.penalty, 1);
});

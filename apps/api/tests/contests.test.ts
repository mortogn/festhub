import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
test(
  "contest API and queue integration (isolated services only)",
  { skip: !databaseUrl || !redisUrl, timeout: 45000 },
  async (t) => {
    // Never inherit the production connection from the root .env.
    assert.equal(new URL(databaseUrl!).hostname, "127.0.0.1");
    assert.equal(new URL(databaseUrl!).pathname, "/festhub_cp_test");
    assert.equal(new URL(redisUrl!).hostname, "127.0.0.1");
    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.ACCESS_TOKEN_SECRET = "contest-integration-test-secret";
    process.env.JUDGE0_URL = "https://judge.test";
    process.env.JUDGE0_AUTH_TOKEN = "test-token";
    const { db, pool } = await import("@festhub/db");
    const schema = await import("@festhub/db/schema");
    const { eq, inArray } = await import("drizzle-orm");
    const { authMiddleware } = await import(
      "../src/middlewares/auth-middleware.js"
    );
    const { generateAccessToken } = await import("../src/utils/jwt.js");
    const { default: contests } = await import(
      "../src/routes/contests/index.js"
    );
    const { default: practice } = await import(
      "../src/routes/practice/index.js"
    );
    const { closeSubmissionQueue } = await import(
      "../src/lib/submission-queue.js"
    );
    const { processSubmission } = await import("../../worker/src/processor.js");
    const { store } = await import("../../worker/src/store.js");
    const { recoverSubmissions } = await import("../../worker/src/recovery.js");
    const { Queue, Worker } = await import("bullmq");
    const { Redis } = await import("ioredis");
    const { SUBMISSION_QUEUE, submissionJobOptions } = await import(
      "@festhub/shared/contest"
    );
    const app = new Hono()
      .use("*", authMiddleware)
      .route("/contests", contests)
      .route("/practice", practice);
    app.onError((error, c) =>
      error instanceof HTTPException
        ? c.json({ message: error.message }, error.status)
        : c.json({ message: error.message }, 500),
    );
    const connection = new Redis(redisUrl!, { maxRetriesPerRequest: null });
    const queue = new Queue(SUBMISSION_QUEUE, { connection });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url) === "https://judge.test/config_info")
        return Response.json({
          max_cpu_time_limit: 15,
          max_wall_time_limit: 20,
          max_memory_limit: 512000,
        });
      assert.match(String(url), /^https:\/\/judge\.test\/languages$/);
      return Response.json([
        { id: 54, name: "C++" },
        { id: 71, name: "Python" },
      ]);
    };
    t.after(async () => {
      globalThis.fetch = originalFetch;
      await closeSubmissionQueue();
      await queue.close();
      await connection.quit();
      await pool.end();
    });
    const {
      usersTable,
      studentsTable,
      eventsTable,
      participantsTable,
      teamsTable,
      contestsTable,
      problemsTable,
      testCasesTable,
      submissionsTable,
      submissionTestCaseResultsTable,
    } = schema;
    const ids = {
      admin: randomUUID(),
      teacher: randomUUID(),
      alice: randomUUID(),
      bob: randomUUID(),
      outsider: randomUUID(),
    };
    await db.insert(usersTable).values(
      Object.entries(ids).map(([name, id]) => ({
        id,
        name,
        email: `${id}@test.invalid`,
        passwordHash: "unused",
        role:
          name === "admin"
            ? ("admin" as const)
            : name === "teacher"
              ? ("teacher" as const)
              : ("student" as const),
      })),
    );
    await db.insert(studentsTable).values(
      [ids.alice, ids.bob, ids.outsider].map((id) => ({
        userId: id,
        studentId: id,
        department: "CSE",
        batch: "1",
      })),
    );
    const cookies = Object.fromEntries(
      await Promise.all(
        Object.entries(ids).map(async ([name, id]) => [
          name,
          `ac_token=${await generateAccessToken({ sub: id, role: name === "admin" ? "admin" : name === "teacher" ? "teacher" : "student" })}`,
        ]),
      ),
    );
    async function request(
      path: string,
      user = "alice",
      method = "GET",
      body?: unknown,
      extraCookie = "",
    ) {
      return app.request(`/contests${path}`, {
        method,
        headers: {
          cookie: `${cookies[user]}; ${extraCookie}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    async function createContest(
      teamBased = false,
      password: string | null = "entry",
    ) {
      const [event] = await db
        .insert(eventsTable)
        .values({
          title: "Test event",
          type: "contest",
          teamBased,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 7200000),
        })
        .returning();
      let teamId: string | null = null;
      if (teamBased) {
        const [team] = await db
          .insert(teamsTable)
          .values({
            eventId: event!.id,
            leaderId: ids.alice,
            name: "Team",
            status: "accepted",
          })
          .returning();
        teamId = team!.id;
      }
      await db.insert(participantsTable).values(
        [ids.alice, ids.bob].map((id) => ({
          studentId: id,
          eventId: event!.id,
          registrationStatus: "accepted",
          teamId,
        })),
      );
      const slug = `test-${randomUUID()}`;
      const response = await request("", "admin", "POST", {
        eventId: event!.id,
        title: "Test contest",
        slug,
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        endsAt: new Date(Date.now() + 7200000).toISOString(),
        isActive: false,
        password,
        allowedLanguages: [54],
      });
      assert.equal(response.status, 201, await response.text());
      const [contest] = await db
        .select()
        .from(contestsTable)
        .where(eq(contestsTable.slug, slug));
      for (const invalid of [
        { cpuLimit: 16, memoryLimit: 131072 },
        { cpuLimit: 2, memoryLimit: 512001 },
      ]) {
        const invalidProblem = await request(
          `/${contest!.id}/problems`,
          "admin",
          "POST",
          { title: "Invalid limits", statement: "Invalid", ...invalid },
        );
        assert.equal(invalidProblem.status, 400);
      }
      const problemResponse = await request(
        `/${contest!.id}/problems`,
        "admin",
        "POST",
        {
          title: "Sum",
          statement: "Add numbers",
          cpuLimit: 2,
          memoryLimit: 131072,
        },
      );
      assert.equal(problemResponse.status, 201);
      const { id: problemId } = await problemResponse.json();
      for (const position of [1, 2, 3]) {
        const response = await request(
          `/${contest!.id}/problems/${problemId}/testcases`,
          "admin",
          "POST",
          {
            position,
            stdin: position === 1 ? "sample-input" : "HIDDEN_INPUT",
            stdout: "ok",
            isSample: position === 1,
          },
        );
        assert.equal(response.status, 201);
      }
      const published = await request(`/${contest!.id}`, "admin", "PUT", {
        isActive: true,
      });
      assert.equal(published.status, 200, await published.text());
      return { contest: contest!, problemId: problemId as string, teamId };
    }
    const individual = await createContest();
    const path = `/${individual.contest.id}`;
    let unlockCookie = "";

    await t.test(
      "teacher and admin authoring, safe publication, and frozen content",
      async () => {
        assert.equal((await request("/limits", "teacher")).status, 200);
        assert.equal((await request("/limits", "alice")).status, 403);
        const fixture = await createContest();
        const base = `/${fixture.contest.id}`;
        const problemsPath = `${base}/problems`;
        const problemPath = `${problemsPath}/${fixture.problemId}`;
        const casesPath = `${problemPath}/testcases`;
        const body = {
          title: "Updated sum",
          statement: "Add two integers.",
          cpuLimit: 1,
          memoryLimit: 65536,
        };
        assert.equal(
          (await request(problemPath, "teacher", "PUT", body)).status,
          200,
        );
        assert.equal(
          (await request(problemPath, "alice", "PUT", body)).status,
          403,
        );
        assert.equal(
          (
            await request(problemPath, "teacher", "PUT", {
              ...body,
              cpuLimit: 16,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `${path}/problems/${fixture.problemId}`,
              "teacher",
              "PUT",
              body,
            )
          ).status,
          400,
        );
        assert.equal(
          (await request(problemsPath, "teacher", "POST", body)).status,
          400,
        ); // Unpublish before adding an incomplete problem.
        assert.equal(
          (await request(base, "teacher", "PUT", { isActive: false })).status,
          200,
        );
        assert.equal(
          (
            await request(base, "teacher", "PUT", {
              allowedLanguages: [999999],
            })
          ).status,
          400,
        );
        const added = await request(problemsPath, "teacher", "POST", body);
        assert.equal(added.status, 201);
        const newProblemId = (await added.json()).id;
        assert.equal(
          (await request(base, "teacher", "PUT", { isActive: true })).status,
          400,
        ); // No cases on new problem.
        const newCasesPath = `${problemsPath}/${newProblemId}/testcases`;
        const newCase = await request(newCasesPath, "teacher", "POST", {
          position: 1,
          stdin: "",
          stdout: "",
          isSample: false,
        });
        assert.equal(newCase.status, 201);
        const newCaseId = (await newCase.json()).id;
        assert.equal(
          (await request(base, "teacher", "PUT", { isActive: true })).status,
          200,
        );
        assert.equal(
          (await request(`${newCasesPath}/${newCaseId}`, "teacher", "DELETE"))
            .status,
          400,
        ); // Last case of a published problem.
        const cases = (await (await request(casesPath, "teacher")).json())
          .testCases;
        const update = {
          position: 4,
          stdin: " 1  2\n",
          stdout: "3\n",
          isSample: false,
        };
        assert.equal(
          (
            await request(
              `${casesPath}/${cases[0].id}`,
              "teacher",
              "PUT",
              update,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`${casesPath}/${cases[0].id}`, "teacher", "PUT", {
              ...update,
              position: 2,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `${newCasesPath}/${cases[0].id}`,
              "teacher",
              "PUT",
              update,
            )
          ).status,
          400,
        );
        const updated = (await (await request(casesPath, "teacher")).json())
          .testCases;
        assert.equal(updated.at(-1).position, 4);
        assert.equal(updated.at(-1).stdin, " 1  2\n");
        assert.equal(
          (await request(`${casesPath}/${cases[0].id}`, "alice", "DELETE"))
            .status,
          403,
        );
        assert.equal(
          (await request(base, "teacher", "PUT", { isActive: false })).status,
          200,
        );
        assert.equal(
          (await request(`${newCasesPath}/${newCaseId}`, "teacher", "DELETE"))
            .status,
          200,
        );
        assert.equal(
          (
            await request(
              `${problemsPath}/${newProblemId}`,
              "teacher",
              "DELETE",
            )
          ).status,
          200,
        );
        assert.equal(
          (await request(`${casesPath}/${cases[0].id}`, "teacher", "DELETE"))
            .status,
          200,
        );
        const removedCases = await db
          .select()
          .from(testCasesTable)
          .where(eq(testCasesTable.problemId, newProblemId));
        assert.equal(removedCases.length, 0);
        assert.equal(
          (await request(base, "teacher", "PUT", { isActive: true })).status,
          200,
        );
        await db
          .update(contestsTable)
          .set({ startsAt: new Date(Date.now() - 60000) })
          .where(eq(contestsTable.id, fixture.contest.id));
        assert.equal(
          (await request(problemPath, "teacher", "PUT", body)).status,
          400,
        );
        assert.equal(
          (await request(problemPath, "teacher", "DELETE")).status,
          400,
        );
        assert.equal(
          (
            await request(
              `${casesPath}/${cases[1].id}`,
              "teacher",
              "PUT",
              update,
            )
          ).status,
          400,
        );
        assert.equal(
          (await request(`${casesPath}/${cases[1].id}`, "teacher", "DELETE"))
            .status,
          400,
        );
        // This fixture is no longer needed; keep it out of subsequent queue recovery tests.
      },
    );

    await t.test(
      "metadata hides password; registration and unlock protect all content",
      async () => {
        const metadata = await (await request(path)).json();
        assert.equal(metadata.hasPassword, true);
        assert.equal(metadata.isLocked, true);
        assert.equal(metadata.password, undefined);
        const [stored] = await db
          .select()
          .from(contestsTable)
          .where(eq(contestsTable.id, individual.contest.id));
        assert.match(stored!.password!, /^\$2/);
        assert.equal((await request(`${path}/problems`)).status, 403);
        assert.equal(
          (
            await request(`${path}/unlock`, "outsider", "POST", {
              password: "entry",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(`${path}/unlock`, "alice", "POST", {
              password: "wrong",
            })
          ).status,
          403,
        );
        const unlocked = await request(`${path}/unlock`, "alice", "POST", {
          password: "entry",
        });
        assert.equal(unlocked.status, 200);
        unlockCookie = unlocked.headers.get("set-cookie")!.split(";")[0]!;
        assert.equal(
          (
            await request(
              `${path}/problems`,
              "alice",
              "GET",
              undefined,
              unlockCookie,
            )
          ).status,
          400,
        ); // Not started.
        assert.equal((await request(`${path}/problems`, "admin")).status, 200);
        await db
          .update(contestsTable)
          .set({ startsAt: new Date(Date.now() - 60000) })
          .where(eq(contestsTable.id, individual.contest.id));
        const samples = await (
          await request(
            `${path}/problems/${individual.problemId}/testcases`,
            "alice",
            "GET",
            undefined,
            unlockCookie,
          )
        ).json();
        assert.equal(samples.testCases.length, 1);
        assert.equal(JSON.stringify(samples).includes("HIDDEN_INPUT"), false);
        assert.equal((await request(`${path}/standings`, "bob")).status, 403);
      },
    );
    let submissionId: string;
    await t.test(
      "submission validation, nested ownership, private results, and ordered judging",
      async () => {
        const route = `${path}/problems/${individual.problemId}/submission`;
        assert.equal(
          (
            await request(
              route,
              "alice",
              "POST",
              { sourceCode: "", languageCode: 54 },
              unlockCookie,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              route,
              "alice",
              "POST",
              { sourceCode: "x".repeat(65537), languageCode: 54 },
              unlockCookie,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              route,
              "alice",
              "POST",
              { sourceCode: "code", languageCode: 71 },
              unlockCookie,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `${path}/problems/${randomUUID()}/submission`,
              "alice",
              "POST",
              { sourceCode: "code", languageCode: 54 },
              unlockCookie,
            )
          ).status,
          400,
        );
        const response = await request(
          route,
          "alice",
          "POST",
          { sourceCode: "code", languageCode: 54 },
          unlockCookie,
        );
        assert.equal(response.status, 201);
        const created = await response.json();
        submissionId = created.id;
        assert.equal(created.status, "queued");
        assert.ok(await queue.getJob(submissionId));
        const tokens: string[] = [];
        await processSubmission(submissionId, store, {
          async create(input) {
            const token = `judge-${tokens.length}`;
            tokens.push(token);
            return token;
          },
          async result(token) {
            return {
              verdict: token === "judge-0" ? "AC" : "WA",
              executionTime: 0.1,
              memoryUsed: 100,
              compileOutput: null,
            };
          },
        });
        assert.equal(tokens.length, 2);
        const detail = await (
          await request(
            `${path}/submissions/${submissionId}`,
            "alice",
            "GET",
            undefined,
            unlockCookie,
          )
        ).json();
        assert.equal(detail.verdict, "WA");
        assert.equal(detail.judged, 2);
        assert.equal(detail.total, 3);
        assert.equal(JSON.stringify(detail).includes("judge-"), false);
        assert.equal(JSON.stringify(detail).includes("HIDDEN_INPUT"), false);
        const bobUnlock = await request(`${path}/unlock`, "bob", "POST", {
          password: "entry",
        });
        const bobCookie = bobUnlock.headers.get("set-cookie")!.split(";")[0]!;
        assert.equal(
          (
            await request(
              `${path}/submissions/${submissionId}`,
              "bob",
              "GET",
              undefined,
              bobCookie,
            )
          ).status,
          404,
        );
        const bobList = await (
          await request(
            `${path}/submissions`,
            "bob",
            "GET",
            undefined,
            bobCookie,
          )
        ).json();
        assert.equal(bobList.submissions.length, 0);
        assert.equal(
          (
            await request(`${path}/problems`, "admin", "POST", {
              title: "Late",
              statement: "Late",
              cpuLimit: 2,
              memoryLimit: 1024,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `${path}/problems/${individual.problemId}/testcases`,
              "admin",
              "POST",
              { position: 4, stdin: "", stdout: "" },
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      "password changes invalidate old access; ended contests reject submissions",
      async () => {
        assert.equal(
          (await request(path, "admin", "PUT", { password: "new-entry" }))
            .status,
          200,
        );
        assert.equal(
          (
            await request(
              `${path}/problems`,
              "alice",
              "GET",
              undefined,
              unlockCookie,
            )
          ).status,
          403,
        );
        await request(path, "admin", "PUT", { password: null });
        await db
          .update(contestsTable)
          .set({ endsAt: new Date() })
          .where(eq(contestsTable.id, individual.contest.id));
        assert.equal(
          (
            await request(
              `${path}/problems/${individual.problemId}/submission`,
              "alice",
              "POST",
              { sourceCode: "code", languageCode: 54 },
            )
          ).status,
          400,
        );
        assert.equal((await request(`${path}/problems`)).status, 200);
      },
    );
    const team = await createContest(true, null);
    await db
      .update(contestsTable)
      .set({ startsAt: new Date(Date.now() - 60000) })
      .where(eq(contestsTable.id, team.contest.id));
    await t.test(
      "team members share submissions and standings; mismatched contest IDs fail",
      async () => {
        const submitted = await (
          await request(
            `/${team.contest.id}/problems/${team.problemId}/submission`,
            "alice",
            "POST",
            { sourceCode: "code", languageCode: 54 },
          )
        ).json();
        await processSubmission(submitted.id, store, {
          async create() {
            return randomUUID();
          },
          async result() {
            return {
              verdict: "AC",
              executionTime: 0.1,
              memoryUsed: 100,
              compileOutput: null,
            };
          },
        });
        assert.equal(
          (
            await request(
              `/${team.contest.id}/submissions/${submitted.id}`,
              "bob",
            )
          ).status,
          200,
        );
        assert.equal(
          (await request(`${path}/submissions/${submitted.id}`, "admin"))
            .status,
          404,
        );
        assert.equal(
          (
            await request(
              `${path}/problems/${team.problemId}/submission`,
              "admin",
            )
          ).status,
          400,
        );
        const standings = await (
          await request(`/${team.contest.id}/standings`, "bob")
        ).json();
        assert.equal(standings.standings.length, 1);
        assert.equal(standings.standings[0].solved, 1);
      },
    );
    await t.test(
      "practice problem sets are open to unregistered students and judge normally",
      async () => {
        const practiceRequest = (
          route: string,
          user = "alice",
          method = "GET",
          body?: unknown,
        ) =>
          app.request(`/practice${route}`, {
            method,
            headers: {
              cookie: cookies[user]!,
              "Content-Type": "application/json",
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        const slug = `practice-${randomUUID()}`;
        assert.equal(
          (
            await practiceRequest("", "admin", "POST", {
              title: "Practice set",
              slug,
              description: "Solve at your own pace",
              allowedLanguages: [54],
              isActive: true,
            })
          ).status,
          400,
        );
        const created = await practiceRequest("", "admin", "POST", {
          title: "Practice set",
          slug,
          description: "Solve at your own pace",
          allowedLanguages: [54],
        });
        assert.equal(created.status, 201);
        const practiceId = (await created.json()).id as string;
        assert.equal(
          (await practiceRequest(`/${practiceId}`, "admin")).status,
          200,
        );
        assert.equal(
          (await request(`/${practiceId}`, "admin")).status,
          404,
        ); // Official routes never expose problem sets.

        const problem = await practiceRequest(
          `/${practiceId}/problems`,
          "admin",
          "POST",
          {
            title: "A + B",
            statement: "Add two integers",
            cpuLimit: 2,
            memoryLimit: 131072,
          },
        );
        assert.equal(problem.status, 201);
        const problemId = (await problem.json()).id as string;
        const testCase = await practiceRequest(
          `/${practiceId}/problems/${problemId}/testcases`,
          "admin",
          "POST",
          { position: 1, stdin: "1 2", stdout: "3", isSample: true },
        );
        assert.equal(testCase.status, 201);
        assert.equal(
          (
            await practiceRequest(`/${practiceId}`, "admin", "PUT", {
              isActive: true,
            })
          ).status,
          200,
        );

        const list = await (await practiceRequest("", "outsider")).json();
        const listed = list.problemSets.find(
          (entry: { id: string }) => entry.id === practiceId,
        );
        assert.equal(listed.problemCount, 1);
        assert.equal(listed.solvedCount, 0);
        const bySlug = await (
          await practiceRequest(`/by-slug/${slug}`, "outsider")
        ).json();
        assert.equal(bySlug.id, practiceId);
        assert.equal(bySlug.problemCount, 1);
        assert.equal(bySlug.solvedCount, 0);
        assert.equal(
          (await practiceRequest(`/${practiceId}/problems`, "outsider")).status,
          200,
        );

        const submitted = await practiceRequest(
          `/${practiceId}/problems/${problemId}/submission`,
          "outsider",
          "POST",
          { sourceCode: "code", languageCode: 54 },
        );
        assert.equal(submitted.status, 201);
        const submissionId = (await submitted.json()).id as string;
        assert.ok(await queue.getJob(submissionId));
        await processSubmission(submissionId, store, {
          async create() {
            return randomUUID();
          },
          async result() {
            return {
              verdict: "AC",
              executionTime: 0.1,
              memoryUsed: 100,
              compileOutput: null,
            };
          },
        });
        const progress = await (
          await practiceRequest(`/${practiceId}/problems`, "outsider")
        ).json();
        assert.equal(progress.problems[0].solved, true);
        assert.equal(progress.problems[0].attempts, 1);
        const refreshed = await (await practiceRequest("", "outsider")).json();
        assert.equal(
          refreshed.problemSets.find(
            (entry: { id: string }) => entry.id === practiceId,
          ).solvedCount,
          1,
        );

        // Published problem sets stay editable; incomplete additions stay out of
        // the student view until they have a test case.
        const second = await practiceRequest(
          `/${practiceId}/problems`,
          "teacher",
          "POST",
          {
            title: "Second problem",
            statement: "Second statement",
            cpuLimit: 1,
            memoryLimit: 1024,
          },
        );
        assert.equal(second.status, 201);
        const secondId = (await second.json()).id as string;
        const beforeCase = await (
          await practiceRequest(`/${practiceId}/problems`, "outsider")
        ).json();
        assert.equal(beforeCase.problems.length, 1);
        assert.equal(
          (
            await practiceRequest(
              `/${practiceId}/problems/${secondId}/testcases`,
              "teacher",
              "POST",
              { position: 1, stdin: "", stdout: "", isSample: false },
            )
          ).status,
          201,
        );
        const afterCase = await (
          await practiceRequest(`/${practiceId}/problems`, "outsider")
        ).json();
        assert.equal(afterCase.problems.length, 2);

        // Ended official contests are practice-only for unregistered students.
        const all = await (await practiceRequest("", "outsider")).json();
        assert.ok(
          all.pastContests.some(
            (entry: { id: string }) => entry.id === individual.contest.id,
          ),
        );
        assert.equal(
          (
            await practiceRequest(
              `/${individual.contest.id}/problems`,
              "outsider",
            )
          ).status,
          200,
        );
        const late = await practiceRequest(
          `/${individual.contest.id}/problems/${individual.problemId}/submission`,
          "outsider",
          "POST",
          { sourceCode: "late", languageCode: 54 },
        );
        assert.equal(late.status, 201);
        const lateId = (await late.json()).id as string;
        await processSubmission(lateId, store, {
          async create() {
            return randomUUID();
          },
          async result() {
            return {
              verdict: "AC",
              executionTime: 0.1,
              memoryUsed: 100,
              compileOutput: null,
            };
          },
        });
        const standings = await (
          await request(`/${individual.contest.id}/standings`, "alice")
        ).json();
        assert.equal(
          standings.standings.find(
            (entry: { id: string }) => entry.id === ids.alice,
          ).solved,
          0,
        );
      },
    );
    await t.test(
      "recovery publishes a submission that was committed without a queue job",
      async () => {
        const configuredRedis = process.env.REDIS_URL;
        let id: string;
        try {
          delete process.env.REDIS_URL; // Fail publishing after the API commits the database row.
          const response = await request(
            `/${team.contest.id}/problems/${team.problemId}/submission`,
            "alice",
            "POST",
            { sourceCode: "recovery", languageCode: 54 },
          );
          assert.equal(response.status, 201);
          id = (await response.json()).id;
        } finally {
          process.env.REDIS_URL = configuredRedis;
        }
        assert.equal(await queue.getJob(id!), undefined);
        await recoverSubmissions(queue);
        assert.ok(await queue.getJob(id!));
        await db
          .update(submissionsTable)
          .set({ status: "error" })
          .where(eq(submissionsTable.id, id!));
      },
    );
    await t.test(
      "exhausted infrastructure failures become errors without contestant verdicts",
      async () => {
        await queue.drain(true);
        const [submission] = await db
          .insert(submissionsTable)
          .values({
            problemId: team.problemId,
            submittedByUserId: ids.alice,
            sourceCode: "infrastructure",
            languageCode: 54,
          })
          .returning();
        const job = await queue.add(
          "judge",
          { submissionId: submission!.id },
          {
            jobId: submission!.id,
            attempts: 3,
            backoff: { type: "fixed", delay: 1 },
          },
        );
        const worker = new Worker(
          SUBMISSION_QUEUE,
          async () => {
            throw new Error("Judge0 temporarily unavailable");
          },
          { connection },
        );
        try {
          const deadline = Date.now() + 5000;
          while ((await job.getState()) !== "failed") {
            if (Date.now() > deadline)
              throw new Error("Retry exhaustion timed out");
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          assert.equal((await queue.getJob(submission!.id))!.attemptsMade, 3);
          await recoverSubmissions(queue);
          const [recorded] = await db
            .select()
            .from(submissionsTable)
            .where(eq(submissionsTable.id, submission!.id));
          assert.equal(recorded!.status, "error");
          assert.equal(recorded!.verdict, null);
          assert.match(recorded!.errorMessage!, /unavailable/);
        } finally {
          await worker.close();
        }
      },
    );
    await t.test(
      "two workers respect global concurrency 4 and refill the first freed slot",
      async () => {
        await queue.drain(true);
        await queue.setGlobalConcurrency(4);
        const rows = await db
          .insert(submissionsTable)
          .values(
            Array.from({ length: 8 }, (_, i) => ({
              problemId: team.problemId,
              submittedByUserId: ids.alice,
              teamId: team.teamId,
              sourceCode: `parallel-${i}`,
              languageCode: 54,
            })),
          )
          .returning();
        const releases = new Map<string, () => void>();
        let active = 0;
        let maximum = 0;
        const started: string[] = [];
        const processor = async (job: { data: { submissionId: string } }) => {
          active++;
          maximum = Math.max(maximum, active);
          started.push(job.data.submissionId);
          try {
            await new Promise<void>((resolve) =>
              releases.set(job.data.submissionId, resolve),
            );
            await processSubmission(job.data.submissionId, store, {
              async create() {
                return randomUUID();
              },
              async result() {
                return {
                  verdict: "AC",
                  executionTime: 0.01,
                  memoryUsed: 100,
                  compileOutput: null,
                };
              },
            });
          } finally {
            active--;
          }
        };
        const workers = [
          new Worker(SUBMISSION_QUEUE, processor, {
            connection,
            concurrency: 4,
          }),
          new Worker(SUBMISSION_QUEUE, processor, {
            connection,
            concurrency: 4,
          }),
        ];
        const waitFor = async (check: () => boolean | Promise<boolean>) => {
          const deadline = Date.now() + 10000;
          while (!(await check())) {
            if (Date.now() > deadline)
              throw new Error("Queue assertion timed out");
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        };
        try {
          await queue.addBulk(
            rows.map((row) => ({
              name: "judge",
              data: { submissionId: row.id },
              opts: { ...submissionJobOptions, jobId: row.id },
            })),
          );
          await waitFor(() => started.length === 4);
          assert.equal(maximum, 4);
          releases.get(started[0]!)!();
          await waitFor(() => started.length === 5);
          assert.equal(active, 4); // Three old submissions plus the replacement.
          for (const release of releases.values()) release();
          await waitFor(() => started.length >= 7);
          for (const release of releases.values()) release();
          await waitFor(() => started.length === 8);
          for (const release of releases.values()) release();
          await waitFor(async () =>
            (
              await db
                .select()
                .from(submissionsTable)
                .where(
                  inArray(
                    submissionsTable.id,
                    rows.map((row) => row.id),
                  ),
                )
            ).every((row) => row.status === "completed"),
          );
          assert.equal(maximum, 4);
          const results = await db
            .select()
            .from(submissionTestCaseResultsTable)
            .where(
              inArray(
                submissionTestCaseResultsTable.submissionId,
                rows.map((row) => row.id),
              ),
            );
          assert.equal(results.length, 24);
        } finally {
          for (const release of releases.values()) release();
          await Promise.all(workers.map((worker) => worker.close(true)));
        }
      },
    );
  },
);

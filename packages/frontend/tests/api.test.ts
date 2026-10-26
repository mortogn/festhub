import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NEXT_PUBLIC_API_URL = "http://api.festhub.test";
const { ApiError, readResponse } = await import("../src/api");

test("keeps the full event conflict explanation and normalizes template whitespace", async () => {
  await assert.rejects(
    readResponse(Response.json({ message: `
      Volunteer Alex (ID: 123) has a schedule conflict
      with Event: Workshop (ID: abc),
      Can not update event until the schedule conflict is solved
    ` }, { status: 400 })),
    (error: unknown) => error instanceof ApiError && error.status === 400 &&
      error.message === "Volunteer Alex (ID: 123) has a schedule conflict with Event: Workshop (ID: abc), Can not update event until the schedule conflict is solved",
  );
});

test("shows every field validation error from Hono instead of a generic failure", async () => {
  await assert.rejects(
    readResponse(Response.json({ success: false, error: { issues: [
      { path: ["maxTeamSize"], message: "Must be at least 1" },
      { path: ["registrationClosesAt"], message: "Must follow registration opening" },
      { path: [], message: "Check the registration period" },
    ] } }, { status: 400 })),
    { message: "Max Team Size: Must be at least 1\nRegistration Closes At: Must follow registration opening\nCheck the registration period" },
  );
});

test("handles non-JSON and malformed errors safely", async () => {
  for (const response of [
    new Response("Unavailable", { status: 502 }),
    Response.json({ message: " " }, { status: 400 }),
    Response.json({ error: { issues: [null, {}, { message: 4 }] } }, { status: 400 }),
  ]) {
    await assert.rejects(readResponse(response), {
      message: "Unable to complete this request. Please try again.",
    });
  }
});

test("returns successful delete responses unchanged", async () => {
  const result = { studentId: "student-id", status: "deleted" };
  assert.deepEqual(await readResponse(Response.json(result)), result);
});

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { UploadTarget } from "../src/uploads";

process.env.NEXT_PUBLIC_API_URL = "http://api.festhub.test";
const { uploadImage, validateImage, refreshImageSession } =
  await import("../src/uploads");

const resourceId = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";
const fields = {
  key: "temp/test/image.png",
  "Content-Type": "image/png",
  policy: "signed-policy",
  "x-amz-signature": "signature",
};
const originalFetch = globalThis.fetch;
const image = () =>
  new File([new Uint8Array([137, 80, 78, 71])], "image.png", {
    type: "image/png",
  });
type Call = { url: URL; init: RequestInit };
let calls: Call[];
let respond: (call: Call) => Response | Promise<Response>;
const json = (data: unknown, status = 200) => Response.json(data, { status });
const presign = () =>
  json({
    id: uploadId,
    url: "https://storage.festhub.test/",
    fields,
    expiresIn: new Date(Date.now() + 900_000).toISOString(),
  });

beforeEach(() => {
  calls = [];
  respond = ({ url }) => {
    if (url.pathname === "/upload/presign") return presign();
    if (url.hostname === "storage.festhub.test")
      return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/confirm"))
      return json({ id: uploadId, status: "accepted" });
    throw new Error(`Unexpected request: ${url}`);
  };
  globalThis.fetch = async (input, init = {}) => {
    const call = {
      url: new URL(input instanceof Request ? input.url : String(input)),
      init,
    };
    calls.push(call);
    return respond(call);
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

for (const type of ["image/jpeg", "image/png", "image/webp"]) {
  test(`accepts ${type} at the exact size limit`, () => {
    const file = new File([new Uint8Array(10_000_000)], "image", { type });
    assert.equal(validateImage(file, { type: "avatar" }).size, 10_000_000);
    assert.equal(calls.length, 0);
  });
}

test("rejects empty, oversized, unsupported, and untyped files before networking", async () => {
  for (const file of [
    new File([], "empty.png", { type: "image/png" }),
    new File([new Uint8Array(10_000_001)], "large.png", { type: "image/png" }),
    new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
    new File(["image"], "image.png"),
  ])
    await assert.rejects(uploadImage(file, { type: "avatar" }, () => {}));
  assert.equal(calls.length, 0);
});

test("rejects invalid resource associations before networking", () => {
  for (const target of [
    { type: "event_banner" },
    { type: "venue_thumbnail", resourceId: "invalid" },
    { type: "avatar", resourceId },
  ])
    assert.throws(() => validateImage(image(), target as UploadTarget));
  assert.equal(calls.length, 0);
});

for (const target of [
  { type: "avatar" },
  { type: "event_thumbnail", resourceId },
  { type: "event_banner", resourceId },
  { type: "venue_thumbnail", resourceId },
] satisfies UploadTarget[]) {
  test(`${target.type}: preserves signed fields, appends the file last, then confirms`, async () => {
    const stages: string[] = [];
    const result = await uploadImage(image(), target, (stage) =>
      stages.push(stage),
    );
    assert.deepEqual(result, { id: uploadId, status: "accepted" });
    assert.deepEqual(stages, ["presigning", "uploading", "confirming"]);
    assert.deepEqual(
      calls.map(({ init }) => init.method),
      ["POST", "POST", "PUT"],
    );
    assert.deepEqual(JSON.parse(calls[0]!.init.body as string), {
      ...target,
      size: 4,
      contentType: "image/png",
    });
    assert.equal(calls[0]!.init.credentials, "include");
    const storage = calls[1]!;
    assert.equal(storage.init.credentials, "omit");
    assert.equal(new Headers(storage.init.headers).has("Content-Type"), false);
    const entries = [...(storage.init.body as FormData).entries()];
    assert.deepEqual(entries.slice(0, -1), Object.entries(fields));
    assert.equal(entries.at(-1)![0], "file");
    const file = entries.at(-1)![1] as File;
    assert.equal(file.name, "image.png");
    assert.deepEqual(
      [...new Uint8Array(await file.arrayBuffer())],
      [137, 80, 78, 71],
    );
    assert.equal(calls[2]!.url.pathname, `/upload/${uploadId}/confirm`);
    assert.equal(calls[2]!.init.credentials, "include");
  });

  test(`${target.type}: recovers a lost confirmation response by reading its resource`, async () => {
    respond = ({ url }) => {
      if (url.pathname === "/upload/presign") return presign();
      if (url.hostname === "storage.festhub.test")
        return new Response(null, { status: 204 });
      if (url.pathname.endsWith("/confirm"))
        throw new TypeError("Response lost");
      if (url.pathname === "/users/self")
        return json({ displayImageId: uploadId });
      if (url.pathname === "/venues")
        return json([{ id: resourceId, thumbnailId: uploadId }]);
      if (url.pathname === `/events/${resourceId}`)
        return json({ thumbnailId: uploadId, bannerId: uploadId });
      throw new Error(`Unexpected request: ${url}`);
    };
    const stages: string[] = [];
    assert.equal(
      (await uploadImage(image(), target, (stage) => stages.push(stage))).id,
      uploadId,
    );
    assert.equal(stages.at(-1), "checking");
    assert.equal(
      calls.filter(({ url }) => url.pathname.endsWith("/confirm")).length,
      1,
    );
    assert.equal(calls.at(-1)!.init.method, "GET");
  });
}

test("presign failure prevents storage upload and confirmation", async () => {
  respond = () => json({ message: "Forbidden" }, 403);
  await assert.rejects(
    uploadImage(image(), { type: "avatar" }, () => {}),
    /prepare.*Forbidden/,
  );
  assert.equal(calls.length, 1);
});

test("expired presign timestamps prevent storage upload and confirmation", async () => {
  respond = () =>
    json({
      id: uploadId,
      url: "https://storage.festhub.test/",
      fields,
      expiresIn: new Date(Date.now() - 1000).toISOString(),
    });
  await assert.rejects(
    uploadImage(image(), { type: "avatar" }, () => {}),
    /expired/,
  );
  assert.equal(calls.length, 1);
});

for (const failure of ["http", "network"]) {
  test(`storage ${failure} failure prevents confirmation; retry starts with a new presign`, async () => {
    let fail = true;
    respond = ({ url }) => {
      if (url.pathname === "/upload/presign") return presign();
      if (url.hostname === "storage.festhub.test") {
        if (!fail) return new Response(null, { status: 204 });
        if (failure === "network") throw new TypeError("Network error");
        return new Response("<Error>AccessDenied</Error>", { status: 403 });
      }
      return json({ id: uploadId, status: "accepted" });
    };
    await assert.rejects(
      uploadImage(image(), { type: "avatar" }, () => {}),
      /Could not upload/,
    );
    assert.equal(calls.length, 2);
    fail = false;
    await uploadImage(image(), { type: "avatar" }, () => {});
    assert.equal(calls[2]!.url.pathname, "/upload/presign");
  });
}

test("failed confirmation never reports acceptance when the saved image differs", async () => {
  respond = ({ url }) => {
    if (url.pathname === "/upload/presign") return presign();
    if (url.hostname === "storage.festhub.test")
      return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/confirm"))
      return json({ message: "Invalid image content" }, 400);
    return json({ displayImageId: null });
  };
  await assert.rejects(
    uploadImage(image(), { type: "avatar" }, () => {}),
    /Invalid image content/,
  );
  assert.equal(
    calls.filter(({ url }) => url.pathname.endsWith("/confirm")).length,
    1,
  );
});

test("unverifiable confirmation asks for reload instead of claiming success", async () => {
  respond = ({ url }) => {
    if (url.pathname === "/upload/presign") return presign();
    if (url.hostname === "storage.festhub.test")
      return new Response(null, { status: 204 });
    throw new TypeError("Network unavailable");
  };
  await assert.rejects(
    uploadImage(image(), { type: "avatar" }, () => {}),
    /Reload this page/,
  );
});

test("presign requests refresh an expired session through the existing API client", async () => {
  let attempts = 0;
  respond = ({ url }) => {
    if (url.pathname === "/upload/presign")
      return attempts++ ? presign() : json({}, 401);
    if (url.pathname === "/auth/refresh-token") return json({});
    if (url.hostname === "storage.festhub.test")
      return new Response(null, { status: 204 });
    return json({ id: uploadId, status: "accepted" });
  };
  await uploadImage(image(), { type: "avatar" }, () => {});
  assert.equal(
    calls.filter(({ url }) => url.pathname === "/auth/refresh-token").length,
    1,
  );
  assert.equal(attempts, 2);
});

test("concurrent avatar failures share one session check", async () => {
  let resolve!: (response: Response) => void;
  respond = () =>
    new Promise<Response>((done) => {
      resolve = done;
    });
  const first = refreshImageSession();
  const second = refreshImageSession();
  assert.equal(first, second);
  assert.equal(calls.length, 1);
  resolve(json({ id: resourceId }));
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
});

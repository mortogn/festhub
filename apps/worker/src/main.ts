import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { pool } from "@festhub/db";
import {
  SUBMISSION_QUEUE,
  SUBMISSION_CONCURRENCY,
  type SubmissionJob,
} from "@festhub/shared/contest";
import { JudgeClient } from "./judge.js";
import { processSubmission } from "./processor.js";
import { store, markError } from "./store.js";
import { recoverSubmissions } from "./recovery.js";

for (const name of [
  "DATABASE_URL",
  "REDIS_URL",
  "JUDGE0_URL",
  "JUDGE0_AUTH_TOKEN",
]) {
  if (!process.env[name]) throw new Error(`${name} must be set`);
}
const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});
connection.on("error", () =>
  console.error("Worker Redis connection unavailable"),
);
const queue = new Queue<SubmissionJob>(SUBMISSION_QUEUE, { connection });
await queue.setGlobalConcurrency(SUBMISSION_CONCURRENCY);
const judge = new JudgeClient(
  process.env.JUDGE0_URL!,
  process.env.JUDGE0_AUTH_TOKEN!,
);
const worker = new Worker<SubmissionJob>(
  SUBMISSION_QUEUE,
  (job) => processSubmission(job.data.submissionId, store, judge),
  {
    connection,
    concurrency: SUBMISSION_CONCURRENCY,
    autorun: false,
  },
);
worker.on("error", (error) =>
  console.error("Submission worker error", error.message),
);
worker.on("completed", (job) =>
  console.info("Submission judged", job.data.submissionId),
);
worker.on("failed", (job, error) => {
  if (!job) return;
  console.error(
    "Submission attempt failed",
    job.data.submissionId,
    error.message,
  );
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
    void markError(job.data.submissionId, error.message).catch(() =>
      console.error(
        "Could not persist submission error",
        job.data.submissionId,
      ),
    );
  }
});
let recovering = false;
let stopping = false;
async function recover() {
  if (recovering || stopping) return;
  recovering = true;
  try {
    await recoverSubmissions(queue);
  } catch (error) {
    console.error(
      "Queue recovery failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    recovering = false;
  }
}
await recover();
const timer = setInterval(() => void recover(), 15000);
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await worker.close();
  await queue.close();
  await connection.quit();
  await pool.end();
}
process.on("SIGTERM", () => void shutdown().catch(() => process.exit(1)));
process.on("SIGINT", () => void shutdown().catch(() => process.exit(1)));
console.info("Submission worker ready; concurrency", SUBMISSION_CONCURRENCY);
await worker.run();

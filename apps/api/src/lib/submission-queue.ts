import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  SUBMISSION_QUEUE,
  submissionJobOptions,
  type SubmissionJob,
} from "@festhub/shared/contest";

let queue: Queue<SubmissionJob> | undefined;
let connection: Redis | undefined;

export async function enqueueSubmission(submissionId: string) {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL must be set");
  if (!queue) {
    connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000,
    });
    connection.on("error", () =>
      console.error("Submission Redis connection unavailable"),
    );
    queue = new Queue<SubmissionJob>(SUBMISSION_QUEUE, { connection });
  }
  await queue.add(
    "judge",
    { submissionId },
    { ...submissionJobOptions, jobId: submissionId },
  );
}

export async function closeSubmissionQueue() {
  await queue?.close();
  connection?.disconnect();
}

import { db } from "@festhub/db";
import { submissionsTable } from "@festhub/db/schema";
import { gt, inArray, and } from "drizzle-orm";
import {
  submissionJobOptions,
  type SubmissionJob,
} from "@festhub/shared/contest";
import type { Queue } from "bullmq";
import { markError } from "./store.js";

export async function recoverSubmissions(queue: Queue<SubmissionJob>) {
  // Keyset pages keep recovery bounded without starving later rows behind a long queue.
  let after: string | undefined;
  while (true) {
    const rows = await db
      .select({ id: submissionsTable.id })
      .from(submissionsTable)
      .where(
        and(
          inArray(submissionsTable.status, ["queued", "processing"]),
          ...(after ? [gt(submissionsTable.id, after)] : []),
        ),
      )
      .orderBy(submissionsTable.id)
      .limit(100);
    for (const { id } of rows) {
      const job = await queue.getJob(id);
      if (!job)
        await queue.add(
          "judge",
          { submissionId: id },
          { ...submissionJobOptions, jobId: id },
        );
      else if (["failed", "completed"].includes(await job.getState())) {
        // A normal processor commits before BullMQ completes the job.
        await markError(
          id,
          job.failedReason || "Queue job finished without a persisted verdict",
        );
      }
    }
    if (rows.length < 100) return;
    after = rows[rows.length - 1]!.id;
  }
}

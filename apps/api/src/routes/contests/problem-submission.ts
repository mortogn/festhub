import { Hono } from "hono";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { problemSubmissionSchema } from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  contestsTable,
  problemsTable,
  submissionsTable,
} from "@festhub/db/schema";
import { throwOnNotAParticipant } from "./_helper.js";
import { and, eq, gt, lt } from "drizzle-orm";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";

const problemSubmissionsParam = zValidator(
  "param",
  z.object({
    problemId: z.uuid(),
    contestId: z.uuid(),
  }),
);

const app = new Hono()
  .post(
    "/",
    enforceAuthMiddleware(["student"]),
    problemSubmissionsParam,
    zValidator("json", problemSubmissionSchema),
    async (c) => {
      const user = c.var.user;
      const { problemId, contestId } = c.req.valid("param");
      const body = c.req.valid("json");

      const now = new Date();

      await db.transaction(async (tx) => {
        const [contest] = await tx
          .select()
          .from(contestsTable)
          .where(
            and(
              eq(contestsTable.id, contestId),
              eq(contestsTable.isActive, true),
            ),
          )
          .for("update");

        if (!contest) throw new BadRequestException("Contest not found");

        if (contest.startsAt > now)
          throw new BadRequestException("Contest has not started yet");

        if (contest.endsAt < now)
          throw new BadRequestException("Contest has already ended");

        const [problem] = await tx
          .select()
          .from(problemsTable)
          .where(
            and(
              eq(problemsTable.id, problemId),
              eq(problemsTable.contestId, contestId),
            ),
          );

        if (!problem) throw new BadRequestException("Problem not found");

        const participant = await throwOnNotAParticipant({
          dbClient: tx,
          studentId: user.id,
          contestId,
        });

        await tx.insert(submissionsTable).values({
          ...body,
          problemId,
          submittedByUserId: user.id,
          teamId: participant.teamId,
        });
      });

      return c.json({ message: "Submission created successfully" }, 201);
    },
  )
  .get("/", enforceAuthMiddleware(), problemSubmissionsParam, async (c) => {
    const { contestId, problemId } = c.req.valid("param");
    const user = c.var.user;

    let whereClauses = [eq(submissionsTable.problemId, problemId)];

    if (!["teacher", "admin"].includes(user.role)) {
      await throwOnNotAParticipant({ studentId: user.id, contestId });

      whereClauses.push(eq(submissionsTable.submittedByUserId, user.id));
    }

    const submissions = await db
      .select()
      .from(submissionsTable)
      .where(and(...whereClauses));

    return c.json(submissions);
  });

export default app;

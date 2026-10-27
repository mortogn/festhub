import { Hono } from "hono";
import { AppVars } from "../../types/variables.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { createProblemSchema } from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  contestsTable,
  eventsTable,
  participantsTable,
  problemsTable,
} from "@festhub/db/schema";
import { and, eq } from "drizzle-orm";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { ForbiddenException } from "../../exceptions/forbidden-exception.js";
import { NotFoundException } from "../../exceptions/not-found-exception.js";
import { throwOnNotAParticipant } from "./_helper.js";

const paramValidator = zValidator("param", z.object({ contestId: z.uuid() }));

const app = new Hono<AppVars>()
  .post(
    "/",
    enforceAuthMiddleware(["teacher", "admin"]),
    paramValidator,
    zValidator("json", createProblemSchema),
    async (c) => {
      const body = c.req.valid("json");
      const { contestId } = c.req.valid("param");

      await db.transaction(async (tx) => {
        const [contest] = await tx
          .select()
          .from(contestsTable)
          .where(eq(contestsTable.id, contestId));

        if (!contest) throw new BadRequestException("Contest not found");

        await tx.insert(problemsTable).values({
          ...body,
          cpuLimitInSeconds: body.cpuLimit,
          memoryLimitInKilobytes: body.memoryLimit,
          contestId: contestId,
        });
      });

      return c.json({ message: "Problem created successfully" }, 201);
    },
  )
  .get("/", enforceAuthMiddleware(), paramValidator, async (c) => {
    const { contestId } = c.req.valid("param");

    const user = c.var.user;

    let whereClauses = [eq(contestsTable.id, contestId)];

    // fetch if teacher/admin or if participant of the contest, otherwise throw error
    if (user.role === "student") {
      await throwOnNotAParticipant({ studentId: user.id, contestId });

      whereClauses.push(eq(contestsTable.isActive, true));
    }

    const [contest] = await db
      .select()
      .from(contestsTable)
      .where(and(...whereClauses));

    if (!contest) throw new NotFoundException("Contest not found");

    const problems = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.contestId, contest.id));

    return c.json({ problems });
  });

export default app;

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { db } from "@festhub/db";
import {
  eventsTable,
  organizersTable,
  teachersTable,
  usersTable,
} from "@festhub/db/schema";
import { and, eq } from "drizzle-orm";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";

export const app = new Hono()
  .post(
    "/assign",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("json", z.object({ teacherId: z.uuid(), eventId: z.uuid() })),
    async (c) => {
      const body = c.req.valid("json");
      const user = c.var.user;

      const organizer = await db.transaction(async (tx) => {
        const [organizer] = await tx
          .select({ teacherId: organizersTable.teacherId })
          .from(organizersTable)
          .where(
            and(
              eq(organizersTable.teacherId, body.teacherId),
              eq(organizersTable.eventId, body.eventId),
            ),
          )
          .for("update");

        if (!!organizer)
          throw new BadRequestException(
            "Teacher is already a organizer for this event",
          );

        const [newOrganizer] = await tx
          .insert(organizersTable)
          .values({
            teacherId: body.teacherId,
            eventId: body.eventId,
            assignedById: user.id,
          })
          .returning();

        return newOrganizer;
      });

      if (!organizer) throw new InternalServerErrorException();

      return c.json(organizer);
    },
  )
  .get(
    "/:eventId",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("param", z.object({ eventId: z.uuid() })),
    async (c) => {
      const { eventId } = c.req.valid("param");

      const organizers = await db.transaction(async (tx) => {
        const [event] = await tx
          .select({ id: eventsTable.id })
          .from(eventsTable)
          .where(eq(eventsTable.id, eventId));

        if (!event) throw new BadRequestException("Invalid eventId provided");

        const organizers = await tx
          .select({
            id: teachersTable.userId,
            teacherId: teachersTable.teacherId,
            name: usersTable.name,
            displayImage: usersTable.displayImage,
            email: usersTable.email,
          })
          .from(organizersTable)
          .innerJoin(
            teachersTable,
            eq(teachersTable.userId, organizersTable.teacherId),
          )
          .innerJoin(usersTable, eq(usersTable.id, teachersTable.userId))
          .where(eq(organizersTable.eventId, eventId));

        return organizers;
      });

      return c.json(organizers);
    },
  );

export default app;

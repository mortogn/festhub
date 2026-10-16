import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  createEventSchema,
  updateEventSchema,
} from "@festhub/shared/validation";
import { Variables } from "../server.js";
import { db } from "@festhub/db";
import { eventsTable } from "@festhub/db/schema";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { eq } from "drizzle-orm";
import z from "zod";
import { NotFoundException } from "../exceptions/not-found-exception.js";

const app = new Hono<{ Variables: Variables }>()
  .post(
    "/",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("json", createEventSchema),
    async (c) => {
      const body = c.req.valid("json");

      const [event] = await db
        .insert(eventsTable)
        .values({
          title: body.title,
          description: body.description,
          type: body.type,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
        })
        .returning({ id: eventsTable.id });

      if (!event) throw new InternalServerErrorException();

      return c.json({ id: event?.id });
    },
  )
  .put(
    "/:id",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("json", updateEventSchema),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const body = c.req.valid("json");
      const param = c.req.valid("param");

      const [event] = await db
        .update(eventsTable)
        .set({
          title: body.title,
          description: body.description,
          type: body.type,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          registrationOpensAt: body.registrationOpensAt,
          registrationClosesAt: body.registrationClosesAt,
          volunteerStartsAt: body.volunteerStartsAt,
          volunteerEndsAt: body.volunteerEndsAt,
          maxVolunteers: body.maxVolunteers,
          isActive: body.isActive,
          teamBased: body.teamBased,
          maxTeamSize: body.maxTeamSize,
          minTeamSize: body.minTeamSize,
          maxTeams: body.maxTeams,
        })
        .where(eq(eventsTable.id, param.id))
        .returning({ id: eventsTable.id });

      if (!event) throw new NotFoundException();

      return c.json({ id: event?.id });
    },
  );

export default app;

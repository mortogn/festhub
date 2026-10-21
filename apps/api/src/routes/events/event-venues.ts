import { db } from "@festhub/db";
import { eventsTable, venuesTable } from "@festhub/db/schema";
import { zValidator } from "@hono/zod-validator";
import { eq, and, ne, lt, gt } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";

const app = new Hono().patch(
  "/:id/venue",
  enforceAuthMiddleware(["teacher", "admin"]),
  zValidator("param", z.object({ id: z.uuid() })),
  zValidator("json", z.object({ venueId: z.uuid() })),
  async (c) => {
    const { venueId } = c.req.valid("json");
    const { id } = c.req.valid("param");

    const venue = await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(eventsTable)
        .where(eq(eventsTable.id, id))
        .for("update");

      if (!event)
        throw new BadRequestException("Invalid id for event provided");

      const [venue] = await tx
        .select()
        .from(venuesTable)
        .where(eq(venuesTable.id, venueId))
        .for("update");

      if (!venue) throw new BadRequestException("Invalid venueId provided");

      const [conflict] = await tx
        .select({ id: eventsTable.id })
        .from(eventsTable)
        .where(
          and(
            eq(eventsTable.venueId, venueId),
            ne(eventsTable.id, id),
            lt(eventsTable.startsAt, event.endsAt),
            gt(eventsTable.endsAt, event.startsAt),
          ),
        )
        .limit(1);

      if (conflict)
        throw new BadRequestException(
          "The venue is not available and can not be selected for this event",
        );

      await tx
        .update(eventsTable)
        .set({ venueId: venue.id })
        .where(eq(eventsTable.id, id));

      return venue;
    });

    return c.json(venue);
  },
);

export default app;

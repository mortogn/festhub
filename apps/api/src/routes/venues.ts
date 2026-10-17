import { db } from "@festhub/db";
import {
  EventSelect,
  eventsTable,
  VenueSelect,
  venuesTable,
} from "@festhub/db/schema";
import {
  createVenueSchema,
  updateVenueSchema,
} from "@festhub/shared/validation";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import { HTTPException } from "hono/http-exception";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { and, desc, eq, gt, lt, notExists } from "drizzle-orm";
import z from "zod";
import { map } from "zod/v3";

const app = new Hono()
  .post(
    "/",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("json", createVenueSchema),
    async (c) => {
      const body = c.req.valid("json");

      try {
        const [venue] = await db
          .insert(venuesTable)
          .values({
            title: body.title,
            description: body.description,
            type: body.type,
            capacity: body.capacity,
          })
          .returning({ id: venuesTable.id });

        if (!venue)
          throw new InternalServerErrorException("Internal server error");

        return c.json(venue);
      } catch (err) {
        if (err instanceof HTTPException) throw err;
        throw new InternalServerErrorException("Internal server error", err);
      }
    },
  )
  .put(
    "/:id",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("json", updateVenueSchema),
    async (c) => {
      const body = c.req.valid("json");

      try {
        const [venue] = await db
          .update(venuesTable)
          .set({
            title: body.title,
            description: body.description,
            capacity: body.capacity,
            type: body.type,
          })
          .returning({ id: venuesTable.id });

        if (!venue) throw new InternalServerErrorException();

        return c.json(venue);
      } catch (err) {
        if (err instanceof HTTPException) throw err;
        throw new InternalServerErrorException("Internal Server Error", err);
      }
    },
  )
  .get("/", enforceAuthMiddleware(["teacher", "admin"]), async (c) => {
    try {
      const venues = await db
        .select()
        .from(venuesTable)
        .orderBy(desc(venuesTable.createdAt));

      return c.json(venues);
    } catch (err) {
      throw new InternalServerErrorException("Internal server error", err);
    }
  })
  .get(
    "/available",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator(
      "query",
      z
        .object({
          startsAt: z.coerce.date(),
          endsAt: z.coerce.date().refine((val) => val > new Date()),
        })
        .refine((val) => val.startsAt < val.endsAt),
    ),
    async (c) => {
      const query = c.req.valid("query");

      const rows = await db
        .select({
          venue: venuesTable,
          blockingEvent: {
            id: eventsTable.id,
            title: eventsTable.title,
          },
        })
        .from(venuesTable)
        .leftJoin(
          eventsTable,
          and(
            eq(eventsTable.venueId, venuesTable.id),
            lt(eventsTable.startsAt, query.endsAt),
            gt(eventsTable.endsAt, query.startsAt),
          ),
        );

      const venueMap = new Map<
        VenueSelect["id"],
        VenueSelect & {
          isAvailable: boolean;
          blockingEvents: Pick<EventSelect, "id" | "title">[];
        }
      >();

      rows.forEach(({ venue, blockingEvent }) => {
        let item = venueMap.get(venue.id);

        if (!item) {
          item = { ...venue, isAvailable: true, blockingEvents: [] };
          venueMap.set(item.id, item);
        }

        if (blockingEvent) {
          item.isAvailable = false;
          item.blockingEvents.push(blockingEvent);
        }
      });

      return c.json([...venueMap.values()]);
    },
  );

export default app;

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { authMiddleware } from "./middlewares/auth-middleware.js";
import { JWTPayload } from "./utils/jwt.js";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { HTTPException } from "hono/http-exception";

import eventsRoutes from "./routes/events.js";
import authRoutes from "./routes/auth.js";
import studentsRoute from "./routes/students.js";
import volunteersRoute from "./routes/volunteers.js";
import venuesRoute from "./routes/venues.js";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  override: false,
});

export type Variables = {
  user:
    | {
        id: JWTPayload["sub"];
        role: JWTPayload["role"];
        authenticated: true;
      }
    | {
        authenticated: false;
      };
};

const app = new Hono<{ Variables: Variables }>()
  .use(logger())
  .use("*", authMiddleware) // Auth Middleware only checks and includes user the request but does not enforce it
  .route("/auth", authRoutes)
  .route("/events", eventsRoutes)
  .route("/students", studentsRoute)
  .route("/volunteers", volunteersRoute)
  .route("/venues", venuesRoute)
  .get("/hello", async (c) => c.text("World"));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    if (err.cause) console.error(err.cause);

    return c.json(
      {
        message: err.message,
      },
      err.status,
    );
  }

  console.error(err);

  return c.json(
    {
      message: "Internal Server Error",
    },
    500,
  );
});

serve({
  fetch: app.fetch,
  port: 8080,
});

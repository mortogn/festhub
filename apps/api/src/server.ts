import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";

import usersRoute from "./routes/users.js";
import eventsRoute from "./routes/events.js";
import { authMiddleware } from "./middlewares/auth-middleware.js";
import { JWTPayload } from "./utils/jwt.js";

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
  .route("/events", eventsRoute);

app.route("/users", usersRoute);

serve({
  fetch: app.fetch,
  port: 8080,
});

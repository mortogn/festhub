import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { authMiddleware } from "./middlewares/auth-middleware.js";
import { JWTPayload } from "./utils/jwt.js";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";

import eventsRoutes from "./routes/events/index.js";
import authRoutes from "./routes/auth.js";
import studentsRoute from "./routes/students.js";
import volunteersRoute from "./routes/volunteers.js";
import venuesRoute from "./routes/venues.js";
import teachersRoute from "./routes/teachers.js";
import organizersRoute from "./routes/organizer.js";
import participantsRoute from "./routes/participants.js";
import teamsRoute from "./routes/teams.js";
import teamInvitesRoute from "./routes/team-invites.js";
import usersRoute from "./routes/users.js";
import uploadRoute from "./routes/upload.js";
import contestRoute from "./routes/contests/index.js";
import { closeSubmissionQueue } from "./lib/submission-queue.js";
import { pool } from "@festhub/db";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  override: false,
});

const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim());

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
  .use(
    "*",
    cors({
      origin: allowedOrigins,
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      credentials: true,
    }),
  )
  .use("*", authMiddleware) // Auth Middleware only checks and includes user the request but does not enforce it
  .route("/auth", authRoutes)
  .route("/events", eventsRoutes)
  .route("/students", studentsRoute)
  .route("/volunteers", volunteersRoute)
  .route("/venues", venuesRoute)
  .route("/teachers", teachersRoute)
  .route("/organizers", organizersRoute)
  .route("/participants", participantsRoute)
  .route("/teams", teamsRoute)
  .route("/team-invites", teamInvitesRoute)
  .route("/users", usersRoute)
  .route("/upload", uploadRoute)
  .route("/contests", contestRoute)
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

const server = serve({
  fetch: app.fetch,
  port: Number(process.env.PORT) || 8080,
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await closeSubmissionQueue();
  await pool.end();
}
process.on("SIGTERM", () => void shutdown().catch(() => process.exit(1)));
process.on("SIGINT", () => void shutdown().catch(() => process.exit(1)));

export type AppType = typeof app;

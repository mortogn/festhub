import { Hono } from "hono";
import { serve } from "@hono/node-server";
import usersRoute from "./routes/users.js";

const app = new Hono();

app.get("/hello", (c) => {
  return c.text("world");
});

app.route("/users", usersRoute);

serve({
  fetch: app.fetch,
  port: 8080,
});

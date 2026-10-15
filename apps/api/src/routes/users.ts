import { Hono } from "hono";

const app = new Hono()
  .get("/:id", (c) => {
    return c.text("user id is " + c.req.param("id") + "");
  })
  .get("/self", (c) => {
    return c.text("self");
  });

export default app;

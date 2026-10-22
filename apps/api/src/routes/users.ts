import { Hono } from "hono";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { db } from "@festhub/db";
import { usersTable } from "@festhub/db/schema";
import { eq } from "drizzle-orm";
import { BadRequestException } from "../exceptions/bad-request-exception.js";

const app = new Hono().get("/self", enforceAuthMiddleware(), async (c) => {
  const authUser = c.var.user;

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayImage: usersTable.displayImage,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(eq(usersTable.id, authUser.id));

  if (!user) throw new BadRequestException();

  return c.json(user);
});

export default app;

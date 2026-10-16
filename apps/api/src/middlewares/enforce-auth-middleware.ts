import { UserSelect } from "@festhub/db/schema";
import { createMiddleware } from "hono/factory";
import { Variables } from "../server.js";
import { AuthException } from "../exceptions/auth-exception.js";
import { ForbiddenException } from "../exceptions/forbidden-exception.js";

export const enforceAuthMiddleware = (roles?: UserSelect["role"][]) =>
  createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.var.user;

    if (!user.authenticated) throw new AuthException();

    if (roles && !roles.includes(user.role)) throw new ForbiddenException();

    await next();
  });

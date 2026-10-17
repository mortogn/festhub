import { UserSelect } from "@festhub/db/schema";
import { createMiddleware } from "hono/factory";
import { AuthException } from "../exceptions/auth-exception.js";
import { ForbiddenException } from "../exceptions/forbidden-exception.js";
import { AuthenticatedUser } from "../types/variables.js";

export const enforceAuthMiddleware = (roles?: UserSelect["role"][]) =>
  createMiddleware<{ Variables: { user: AuthenticatedUser } }>(
    async (c, next) => {
      const user = c.var.user;

      if (!user.authenticated) throw new AuthException();

      if (roles && !roles.includes(user.role)) throw new ForbiddenException();

      await next();
    },
  );

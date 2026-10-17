import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../utils/jwt.js";
import { Variables } from "../server.js";

// This middleware only checks if user is logged in, does not enforce it
export const authMiddleware = createMiddleware<{
  Variables: Variables;
}>(async (c, next) => {
  c.set("user", { authenticated: false });

  try {
    const ac_token = getCookie(c, "ac_token");

    if (ac_token) {
      const payload = await verifyAccessToken(ac_token);

      c.set("user", {
        id: payload.sub,
        role: payload.role,
        authenticated: true,
      });
    }
  } catch {}

  await next();
});

import type { AppType } from "@festhub/api";
import { hc } from "hono/client";

const client = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!, {
  init: { credentials: "include" },
});

export default client;

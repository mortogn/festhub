import { Hono } from "hono";

import { getJudgeLanguages } from "./_helper.js";

const app = new Hono().get("/", async (c) => {
  const data = await getJudgeLanguages();

  return c.json(data as Array<{ id: number; name: string }>);
});

export default app;

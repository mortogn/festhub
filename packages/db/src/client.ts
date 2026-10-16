import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  override: false,
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

const pool = new Pool({
  connectionString,
  max: 10,
});

const db = drizzle({ client: pool });

export { db, pool };

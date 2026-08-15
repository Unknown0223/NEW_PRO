import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://hr_hub:hr_hub@127.0.0.1:5433/hr_hub";

const globalForDb = globalThis as unknown as {
  hrHubPool?: Pool;
};

export const pool =
  globalForDb.hrHubPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.hrHubPool = pool;
}

export const db = drizzle(pool, { schema });

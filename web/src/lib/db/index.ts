import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const rawUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/primus_usage";

const isLocal = rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");

const pool = new Pool({
  connectionString: rawUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
export * from "./schema";

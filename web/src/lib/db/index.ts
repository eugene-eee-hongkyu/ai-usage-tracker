import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const rawUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/primus_usage";

// Parse URL to guarantee password is a string (pg SCRAM auth requires it)
let pool: Pool;
try {
  const u = new URL(rawUrl);
  pool = new Pool({
    host: u.hostname || "localhost",
    port: parseInt(u.port) || 5432,
    database: u.pathname.slice(1) || "primus_usage",
    user: u.username || "postgres",
    password: u.password || "postgres",
    ssl: u.searchParams.get("sslmode") === "require" ? { rejectUnauthorized: false } : false,
  });
} catch {
  pool = new Pool({ connectionString: rawUrl });
}

export const db = drizzle(pool, { schema });
export * from "./schema";

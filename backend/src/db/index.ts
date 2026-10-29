import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// node-postgres pool — reliable for a long-running Express server.
// Neon free tier can pause (cold start). We raise timeouts to handle wake-up.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 30_000, // Neon cold start can take ~10-15 s
  allowExitOnIdle: false,
});

// Warm the pool on startup so the first auth request isn't slow
pool.query("SELECT 1").catch(() => {
  console.error("Database startup check failed; requests will retry on demand.");
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error", { name: err.name });
});

export const db = drizzle(pool, { schema });
export { schema };

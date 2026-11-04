/**
 * Database connection — Neon serverless HTTP driver.
 *
 * The neon() function makes HTTPS requests to the Neon API endpoint.
 * In this environment, Node.js's built-in fetch cannot reach AWS IPs,
 * so globalThis.fetch is patched in src/index.ts (via curlFetch.ts) to
 * route all *.neon.tech requests through curl instead.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
export { schema };

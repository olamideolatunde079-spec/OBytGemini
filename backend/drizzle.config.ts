import type { Config } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

// DATABASE_URL_DIRECT is the non-pooler Neon URL without channel_binding param,
// used by drizzle-kit for schema push/generate (needs a direct TCP connection).
// Falls back to DATABASE_URL if not set.
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is required for drizzle-kit");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema, isRealDatabaseConfigured } from "../db/index.js";

const authSecret =
  process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32
    ? process.env.BETTER_AUTH_SECRET.trim()
    : "obytgemini-default-dev-secret-key-at-least-32-chars-long";

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};

// GitHub OAuth
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    mapProfileToUser: (profile) => ({
      name: profile.name || profile.login || "GitHub User",
      email: profile.email || `github-${profile.id}@users.noreply.github.com`,
    }),
  };
  console.log("✅ GitHub OAuth configured");
}

// Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
  console.log("✅ Google OAuth configured");
}

let authInstance: any;

try {
  if (isRealDatabaseConfigured()) {
    authInstance = betterAuth({
      database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
          user: schema.user,
          session: schema.session,
          account: schema.account,
          verification: schema.verification,
        },
      }),
      baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      secret: authSecret,
      trustedOrigins: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
      ],
      emailAndPassword: {
        enabled: true,
        disableSignUp: false,
        requireEmailVerification: false,
        minPasswordLength: 8,
      },
      socialProviders,
      advanced: {
        useSecureCookies: process.env.NODE_ENV === "production",
      },
    });
  } else {
    // In-memory fallback auth instance
    authInstance = {
      api: {
        getSession: async () => null,
      },
      handler: async () => new Response("OK"),
    };
  }
} catch (err) {
  console.warn("⚠️ Better Auth initialization deferred to fallback:", err);
  authInstance = {
    api: {
      getSession: async () => null,
    },
    handler: async () => new Response("OK"),
  };
}

export const auth = authInstance;

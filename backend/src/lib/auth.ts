import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "../db/index.js";

const authSecret = process.env.BETTER_AUTH_SECRET?.trim();
if (!authSecret || authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
}

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};

// GitHub OAuth — required for GitHub sign-in
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
} else {
  console.warn("⚠️  GitHub OAuth credentials missing");
}

// Google OAuth — optional
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
  console.log("✅ Google OAuth configured");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:5000",
  secret: authSecret,

  trustedOrigins: [
    process.env.FRONTEND_URL ?? "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5175",
  ],

  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },

  socialProviders,
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

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

  // Allow requests from the frontend origin
  trustedOrigins: [process.env.FRONTEND_URL ?? "http://localhost:5173"],

  // Email + password — enabled, no email verification required for dev
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },

  // Social providers (GitHub now, Google when configured)
  socialProviders,
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

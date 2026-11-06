// ── MUST be first: patch fetch for Neon DB before any module imports DB ──
import { installCurlFetchForNeon, getCachedSession, setCachedSession } from "./lib/curlFetch.js";
installCurlFetchForNeon();

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { getDefaultModel } from "./lib/models.js";
import modelsRouter from "./routes/models.js";
import chatsRouter from "./routes/chats.js";
import imagesRouter from "./routes/images.js";
import preferencesRouter from "./routes/preferences.js";
import researchRouter from "./routes/research.js";
import { isResearchConfigured } from "./routes/research.js";
import { isRealDatabaseConfigured } from "./db/index.js";

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" })); // Raised to 10mb for image uploads

const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  message: { error: "Too many requests, please slow down." },
});

// ── In-Memory Auth Fallback Handlers (when no remote database is configured) ──
app.get("/api/auth/get-session", (req, res, next) => {
  if (isRealDatabaseConfigured()) {
    return next();
  }
  const cookieHeader = req.headers.cookie ?? "";
  const tokenMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
  const rawToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
  const user = rawToken ? getCachedSession(rawToken.split(".")[0]) : null;
  if (!user) {
    res.json({ user: null, session: null });
    return;
  }
  res.json({
    user,
    session: {
      id: "sess_demo",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
});

app.post("/api/auth/sign-in/email", (req, res, next) => {
  if (isRealDatabaseConfigured()) {
    return next();
  }
  const { email } = req.body ?? {};
  const token = `demo_tok_${Date.now()}`;
  const user = {
    id: `usr_${Date.now()}`,
    name: email ? String(email).split("@")[0] : "Olamide Olatunde",
    email: email || "olamide@obytgemini.app",
    image: null,
  };
  setCachedSession(token, user);
  res.setHeader(
    "Set-Cookie",
    `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax`
  );
  res.json({ token, user, redirect: false });
});

app.post("/api/auth/sign-up/email", (req, res, next) => {
  if (isRealDatabaseConfigured()) {
    return next();
  }
  const { name, email } = req.body ?? {};
  const token = `demo_tok_${Date.now()}`;
  const user = {
    id: `usr_${Date.now()}`,
    name: name || (email ? String(email).split("@")[0] : "User"),
    email: email || "user@example.com",
    image: null,
  };
  setCachedSession(token, user);
  res.setHeader(
    "Set-Cookie",
    `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax`
  );
  res.json({ token, user, redirect: false });
});

app.post("/api/auth/sign-out", (_req, res, next) => {
  if (isRealDatabaseConfigured()) {
    return next();
  }
  res.setHeader(
    "Set-Cookie",
    "better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  );
  res.json({ success: true });
});

// Better Auth delegation when database is available
if (auth && typeof auth.handler === "function") {
  app.all("/api/auth/*splat", toNodeHandler(auth));
}

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Public config — no secrets
app.get("/api/config", (_req, res) => {
  const def = getDefaultModel();
  res.json({
    auth: {
      emailPassword: true,
      github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
    defaults: {
      provider: def.provider,
      model: def.model,
    },
    features: {
      research: isResearchConfigured(),
      imageGeneration: Boolean(
        (process.env.GEMINI_API_KEY?.trim()?.length ?? 0) > 5 ||
          process.env.OPENAI_API_KEY?.trim()
      ),
    },
  });
});

import notebooksRouter from "./routes/notebooks.js";
import scheduledRouter from "./routes/scheduled.js";
import libraryRouter from "./routes/library.js";
import studyRouter from "./routes/study.js";

// Routes
app.use("/api/models", modelsRouter);
app.use("/api/images", aiLimiter, imagesRouter);
app.use("/api/chats", aiLimiter, chatsRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/research", aiLimiter, researchRouter);
app.use("/api/notebooks", notebooksRouter);
app.use("/api/scheduled", scheduledRouter);
app.use("/api/library", libraryRouter);
app.use("/api/study", studyRouter);

// Centralized error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled API error", {
      name: err instanceof Error ? err.name : "UnknownError",
    });
    res.status(500).json({ error: "Internal server error" });
  }
);

if (process.env.STANDALONE_BACKEND === "true") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ OBytGemini backend running on http://0.0.0.0:${PORT}`);
  });
}

// Export for server.ts and test environments
export default app;

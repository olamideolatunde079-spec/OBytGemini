// ── MUST be first: patch fetch for Neon DB before any module imports DB ──
import { installCurlFetchForNeon } from "./lib/curlFetch.js";
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

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" })); // Raised to 10mb for image uploads

const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: "Too many requests, please slow down." },
});

// Better Auth
app.all("/api/auth/*splat", toNodeHandler(auth));

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
        (process.env.GEMINI_API_KEY?.trim()?.length ?? 0) > 10 ||
          process.env.OPENAI_API_KEY?.trim()
      ),
    },
  });
});

// Routes
app.use("/api/models", modelsRouter);
app.use("/api/images", aiLimiter, imagesRouter);
app.use("/api/chats", aiLimiter, chatsRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/research", aiLimiter, researchRouter);

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

app.listen(PORT, () => {
  console.log(`✅ OBytGemini backend running on http://localhost:${PORT}`);
});

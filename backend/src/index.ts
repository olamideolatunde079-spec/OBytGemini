import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import modelsRouter from "./routes/models.js";
import chatsRouter from "./routes/chats.js";

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

// CORS — allow frontend origin
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "1mb" }));

// Rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: "Too many requests, please slow down." },
});

// Better Auth handles /api/auth/*
app.all("/api/auth/*splat", toNodeHandler(auth));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Public config — tells the frontend which auth providers are available.
// No secrets are exposed — only boolean flags.
app.get("/api/config", (_req, res) => {
  res.json({
    auth: {
      emailPassword: true,
      github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  });
});

// Routes
app.use("/api/models", modelsRouter);
app.use("/api/chats", aiLimiter, chatsRouter);

// Centralized error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled API request error", {
      name: err instanceof Error ? err.name : "UnknownError",
    });
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, () => {
  console.log(`✅ OBytGemini backend running on http://localhost:${PORT}`);
});

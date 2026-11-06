import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import backendApp from "./backend/src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = "0.0.0.0";

app.set("trust proxy", 1);

// Mount backend API routes first
app.use(backendApp);

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false,
      host: HOST,
    },
    appType: "spa",
    root: path.resolve(__dirname, "frontend"),
  });

  app.use(vite.middlewares);

  // Catch-all for HTML (Express 5 compatible without path-to-regexp '*' error)
  app.use(async (req, res, next) => {
    if (req.method !== "GET" || req.originalUrl.startsWith("/api")) {
      return next();
    }
    try {
      const templatePath = path.resolve(__dirname, "frontend/index.html");
      const template = fs.readFileSync(templatePath, "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  const distPath = path.resolve(__dirname, "dist/frontend");
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.originalUrl.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`🚀 OBytGemini server running on http://${HOST}:${PORT}`);
});

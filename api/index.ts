/**
 * api/index.ts — Vercel Serverless Function entry point
 *
 * @vercel/node picks this file up and wraps it as a serverless function.
 * ALL /api/* requests are routed here by vercel.json rewrites.
 *
 * Key design decisions:
 * 1. STANDALONE_BACKEND is set to "false" before the backend imports so the
 *    Express app.listen() call is skipped (Vercel manages the server lifecycle).
 * 2. The curlFetch patch is auto-skipped because Vercel sets VERCEL=1 at runtime.
 * 3. We use IncomingMessage/ServerResponse from "http" — these are the native
 *    Node types that both Express and @vercel/node share, so no extra type pkg needed.
 * 4. Streaming (SSE / AI text chunks) works because @vercel/node keeps the
 *    HTTP response open until res.end() is called — fully compatible with Express streaming.
 */

// Must be set before any backend module is imported so app.listen() is skipped.
process.env.STANDALONE_BACKEND = "false";

import type { IncomingMessage, ServerResponse } from "node:http";

// Dynamically import so env vars above are definitely set before module init
const { default: app } = await import("../backend/src/index.js");

export default function handler(
  req: IncomingMessage,
  res: ServerResponse
): void {
  app(req, res);
}

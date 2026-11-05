/**
 * curlFetch — async curl-based fetch polyfill for Neon DB calls.
 *
 * WHY THIS EXISTS (local dev only):
 * On this specific development machine, Node.js's built-in fetch (undici)
 * cannot open TCP connections to AWS IP ranges (ETIMEDOUT). The Neon
 * PostgreSQL API lives on AWS IPs. curl uses the system's libcurl which
 * CAN reach those IPs, so we route Neon-bound fetch calls through curl.
 *
 * ON VERCEL: Node.js fetch works fine — no curl needed.
 * The IS_VERCEL check skips this patch entirely in production.
 */

import { spawn } from "node:child_process";

// ── Async curl via spawn ───────────────────────────────────────────────────

function curlFetch(url: string, options: RequestInit = {}): Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
}> {
  return new Promise((resolve, reject) => {
    const method = (options.method ?? "GET").toUpperCase();
    const rawHeaders =
      options.headers && typeof options.headers === "object"
        ? (options.headers as Record<string, string>)
        : {};

    const args: string[] = ["-s", "--max-time", "15", "-X", method];

    for (const [k, v] of Object.entries(rawHeaders)) {
      args.push("-H", `${k}: ${v}`);
    }

    const bodyRaw = options.body;
    let stdinBuf: Buffer | undefined;
    if (bodyRaw) {
      stdinBuf =
        typeof bodyRaw === "string"
          ? Buffer.from(bodyRaw, "utf8")
          : Buffer.isBuffer(bodyRaw)
            ? (bodyRaw as Buffer)
            : Buffer.from(JSON.stringify(bodyRaw), "utf8");
      args.push("--data-binary", "@-");
    }

    args.push("--write-out", "\n__STATUS__%{http_code}");
    args.push(url);

    const proc = spawn("curl", args, { stdio: ["pipe", "pipe", "ignore"] });

    const chunks: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));

    if (stdinBuf) {
      proc.stdin.write(stdinBuf);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("curlFetch timeout after 15s"));
    }, 20_000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`curl exited with code ${code}`));
        return;
      }
      const stdout = Buffer.concat(chunks).toString("utf8");
      const statusMatch = stdout.match(/\n__STATUS__(\d+)\s*$/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
      const responseBody = stdout.replace(/\n__STATUS__\d+\s*$/, "");

      resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => JSON.parse(responseBody),
        text: async () => responseBody,
        headers: { get: (_name: string) => null },
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`curl spawn error: ${err.message}`));
    });
  });
}

// ── Session cache (avoid repeated DB queries for the same session token) ──
// Better Auth verifies sessions via DB on every request. Caching for 30s
// eliminates repeated DB hits for the auth check.
const sessionCache = new Map<string, { user: unknown; expiry: number }>();
const SESSION_TTL_MS = 30_000;

export function getCachedSession(token: string): unknown | null {
  const entry = sessionCache.get(token);
  if (entry && entry.expiry > Date.now()) return entry.user;
  sessionCache.delete(token);
  return null;
}

export function setCachedSession(token: string, user: unknown): void {
  sessionCache.set(token, { user, expiry: Date.now() + SESSION_TTL_MS });
}

// Prune expired entries every minute (unref so it doesn't prevent exit)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessionCache) {
    if (entry.expiry <= now) sessionCache.delete(key);
  }
}, 60_000).unref();

// ── Install the patched fetch ──────────────────────────────────────────────
export function installCurlFetchForNeon(): void {
  // On Vercel (and most cloud environments), Node.js fetch works fine to Neon.
  // Only patch fetch on local machines where Node's undici is blocked from AWS.
  const isVercel = Boolean(process.env.VERCEL);
  if (isVercel) {
    console.log("✅ Vercel environment — using native fetch for Neon DB");
    return;
  }

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function patchedFetch(
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    if (url.includes(".neon.tech")) {
      const result = await curlFetch(url, init ?? {});
      return {
        ok: result.ok,
        status: result.status,
        statusText: result.ok ? "OK" : "Error",
        json: result.json,
        text: result.text,
        headers: result.headers as unknown as Headers,
        body: null,
        bodyUsed: false,
        redirected: false,
        type: "basic" as Response["type"],
        url,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([]),
        formData: async () => new FormData(),
        clone: function (this: Response) { return this; },
      } as unknown as Response;
    }

    return originalFetch.call(this, input, init);
  };

  console.log("✅ Async curl-fetch installed for Neon DB (non-blocking)");
}

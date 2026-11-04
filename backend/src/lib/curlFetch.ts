/**
 * curlFetch — replaces globalThis.fetch for Neon DB calls with a curl-backed
 * implementation that works around the ETIMEDOUT block on AWS IPs from Node.js.
 *
 * Uses execFileSync (not execSync) so arguments are passed as an array —
 * no shell quoting issues with special characters in the database URL.
 */

import { execFileSync } from "node:child_process";

interface FakeFetchResult {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
}

function curlFetch(url: string, options: RequestInit = {}): Promise<FakeFetchResult> {
  return new Promise((resolve, reject) => {
    try {
      const method = (options.method ?? "GET").toUpperCase();
      const rawHeaders =
        options.headers && typeof options.headers === "object"
          ? (options.headers as Record<string, string>)
          : {};

      // Build args array — no shell, no quoting issues
      const args: string[] = ["-s", "--max-time", "20", "-X", method];

      for (const [k, v] of Object.entries(rawHeaders)) {
        args.push("-H", `${k}: ${v}`);
      }

      const body = options.body;
      let stdinBuf: Buffer | undefined;
      if (body) {
        stdinBuf =
          typeof body === "string"
            ? Buffer.from(body, "utf8")
            : Buffer.isBuffer(body)
              ? (body as Buffer)
              : Buffer.from(JSON.stringify(body), "utf8");
        args.push("--data-binary", "@-");
      }

      args.push("--write-out", "\n__STATUS__%{http_code}");
      args.push(url);

      const stdout = execFileSync("curl", args, {
        timeout: 25_000,
        maxBuffer: 10 * 1024 * 1024,
        input: stdinBuf,
      }).toString("utf8");

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
    } catch (err: unknown) {
      reject(
        new Error(
          `curlFetch failed: ${err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)}`
        )
      );
    }
  });
}

/**
 * Install the curl-based fetch polyfill.
 * Only Neon-related URLs (*.neon.tech) are routed through curl.
 * All other URLs (AI providers, Better Auth, etc.) use the original fetch.
 */
export function installCurlFetchForNeon(): void {
  const originalFetch = globalThis.fetch;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = async function patchedFetch(
    input: string | URL | { url: string },
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as { url: string }).url;

    if (url.includes(".neon.tech")) {
      const result = await curlFetch(url, init ?? {});
      // Minimal Response-compatible object
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

    return originalFetch.call(this, input as string | URL | Request, init);
  };

  console.log("✅ curl-fetch installed for Neon DB (AWS IP bypass)");
}

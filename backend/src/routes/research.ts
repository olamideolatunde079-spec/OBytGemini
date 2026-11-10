/**
 * /api/research — web research capability
 *
 * Uses Tavily Search API (https://tavily.com) when TAVILY_API_KEY is set.
 *
 * Endpoints:
 *   GET  /api/research/status   — check if research is available
 *   POST /api/research          — quick web search (web_search_depth: "basic")
 *   POST /api/research/deep     — deep research (multiple queries, more results)
 *
 * Both POST endpoints stream progress via SSE-style ndjson so the UI can show
 * "Searching…", "Reading sources…", "Generating answer…" in real time.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

interface AuthUser { id: string; name: string; email: string; image?: string | null }
const getUser = (req: Request): AuthUser => (req as Request & { user: AuthUser }).user;

// ── Configuration ─────────────────────────────────────────────────────────────
export function isResearchConfigured(): boolean {
  const key = process.env.TAVILY_API_KEY?.trim();
  return Boolean(key && key.length > 10);
}

// ── Tavily helper ─────────────────────────────────────────────────────────────
interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
}

interface TavilyResponse {
  answer?: string;
  results?: TavilyResult[];
  query?: string;
}

async function tavilySearch(
  query: string,
  options: {
    maxResults?: number;
    searchDepth?: "basic" | "advanced";
    includeAnswer?: boolean;
    includeDomains?: string[];
    maxSnippetLen?: number;
  } = {}
): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

  const {
    maxResults = 5,
    searchDepth = "basic",
    includeAnswer = true,
    maxSnippetLen = 400,
  } = options;

  const body: Record<string, unknown> = {
    query,
    max_results: maxResults,
    search_depth: searchDepth,
    include_answer: includeAnswer,
    include_raw_content: false,
    include_images: false,
  };

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: string; detail?: string };
    const msg = errBody?.error ?? errBody?.detail ?? `Tavily returned HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = (await res.json()) as TavilyResponse;

  // Trim snippet length to keep context windows manageable
  if (data.results) {
    data.results = data.results.map(r => ({
      ...r,
      content: (r.content ?? "").slice(0, maxSnippetLen),
    }));
  }

  return data;
}

function sanitizeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    // Block internal/private addresses (basic SSRF guard)
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.") ||
      host === "::1"
    ) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// ── GET /api/research/status ──────────────────────────────────────────────────
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    available: isResearchConfigured(),
    provider: isResearchConfigured() ? "tavily" : null,
  });
});

// ── POST /api/research — quick web search ────────────────────────────────────
const searchSchema = z.object({
  query: z.string().trim().min(1).max(500),
  maxResults: z.number().int().min(1).max(8).optional().default(5),
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  void getUser(req); // authenticated — user object available but not needed here

  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  if (!isResearchConfigured()) {
    res.status(503).json({
      error:
        "Web research is not configured. Add TAVILY_API_KEY=tvly-... to backend/.env. " +
        "Get a free key at https://tavily.com",
    });
    return;
  }

  try {
    const { query, maxResults } = parsed.data;
    const data = await tavilySearch(query, { maxResults, searchDepth: "basic" });

    const sources = (data.results ?? [])
      .filter(r => sanitizeUrl(r.url ?? "") !== null)
      .map(r => ({
        title: r.title ?? "Untitled",
        url: r.url ?? "",
        snippet: r.content ?? "",
        publishedDate: r.published_date ?? null,
      }));

    res.json({ answer: data.answer ?? "", sources, query });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Search failed";
    console.error("[research] search error:", msg);
    res.status(502).json({ error: msg });
  }
});

// ── POST /api/research/deep — deep research (multiple parallel queries) ───────
const deepSchema = z.object({
  query: z.string().trim().min(1).max(500),
  maxResultsPerQuery: z.number().int().min(1).max(5).optional().default(4),
});

router.post("/deep", async (req: Request, res: Response): Promise<void> => {
  void getUser(req);

  const parsed = deepSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  if (!isResearchConfigured()) {
    res.status(503).json({
      error: "Web research is not configured. Add TAVILY_API_KEY to backend/.env.",
    });
    return;
  }

  // Stream progress updates as NDJSON (one JSON object per line)
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (obj: Record<string, unknown>) => {
    res.write(JSON.stringify(obj) + "\n");
  };

  try {
    const { query, maxResultsPerQuery } = parsed.data;

    // Step 1 — build search queries
    send({ step: "planning", message: "Identifying key search queries…" });

    // Simple query expansion: original + a "latest" variant + a comparison variant
    const queries = [
      query,
      `${query} latest 2025 2026`,
      `${query} expert analysis`,
    ];

    // Step 2 — run searches concurrently
    send({ step: "searching", message: `Searching the web with ${queries.length} queries…`, queries });

    const results = await Promise.allSettled(
      queries.map(q =>
        tavilySearch(q, {
          maxResults: maxResultsPerQuery,
          searchDepth: "advanced",
          maxSnippetLen: 500,
        })
      )
    );

    // Step 3 — deduplicate sources by URL
    const seenUrls = new Set<string>();
    const allSources: Array<{
      title: string;
      url: string;
      snippet: string;
      publishedDate: string | null;
      relevanceScore: number;
    }> = [];

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const r of result.value.results ?? []) {
        const cleanUrl = sanitizeUrl(r.url ?? "");
        if (!cleanUrl || seenUrls.has(cleanUrl)) continue;
        seenUrls.add(cleanUrl);
        allSources.push({
          title: r.title ?? "Untitled",
          url: cleanUrl,
          snippet: r.content ?? "",
          publishedDate: r.published_date ?? null,
          relevanceScore: r.score ?? 0,
        });
      }
    }

    // Sort by relevance score (highest first) and cap at 15 sources
    allSources.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topSources = allSources.slice(0, 15);

    send({
      step: "sources_found",
      message: `Found ${topSources.length} relevant sources across ${queries.length} searches.`,
      sourceCount: topSources.length,
    });

    // Step 4 — collect any AI answers from Tavily
    const tavilyAnswers = results
      .filter((r): r is PromiseFulfilledResult<TavilyResponse> => r.status === "fulfilled")
      .map(r => r.value.answer ?? "")
      .filter(Boolean);

    // Step 5 — done, return everything
    send({
      step: "done",
      query,
      sources: topSources,
      tavilyAnswers,
      message: "Research complete. Generating your answer…",
    });

    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Deep research failed";
    console.error("[research/deep] error:", msg);
    send({ step: "error", error: msg });
    res.end();
  }
});

export default router;

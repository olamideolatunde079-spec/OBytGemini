/**
 * /api/research — web research capability
 * Uses Tavily API (https://tavily.com) when TAVILY_API_KEY is configured.
 * When no key is present, the endpoint returns a clear "not configured" response
 * and isResearchConfigured() returns false so the frontend can hide the feature.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}
const getUser = (req: Request): AuthUser =>
  (req as Request & { user: AuthUser }).user;

// ── Configuration check ──────────────────────────────────────────────────────
export function isResearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

// ── GET /api/research/status — check if research is available ──────────────
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    available: isResearchConfigured(),
    provider: isResearchConfigured() ? "tavily" : null,
  });
});

// ── POST /api/research — perform a web search ─────────────────────────────
const researchSchema = z.object({
  query: z.string().trim().min(1).max(500),
  maxResults: z.number().int().min(1).max(10).optional(),
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const _user = getUser(req);

  const parsed = researchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      error:
        "Web research is not configured. Add a TAVILY_API_KEY to backend/.env " +
        "to enable real web search. Get a key at https://tavily.com",
    });
    return;
  }

  try {
    const maxResults = parsed.data.maxResults ?? 5;

    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: parsed.data.query,
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!tavilyRes.ok) {
      const errBody = await tavilyRes.json().catch(() => ({})) as { error?: string };
      res.status(502).json({
        error: errBody?.error ?? `Search provider returned HTTP ${tavilyRes.status}`,
      });
      return;
    }

    const data = (await tavilyRes.json()) as {
      answer?: string;
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
      }>;
    };

    const sources = (data.results ?? []).map((r) => ({
      title: r.title ?? "Untitled",
      url: r.url ?? "",
      snippet: (r.content ?? "").slice(0, 300),
    }));

    res.json({
      answer: data.answer ?? "",
      sources,
    });
  } catch (err: unknown) {
    console.error("Research error", {
      name: err instanceof Error ? err.name : "UnknownError",
    });
    res.status(500).json({
      error: "The search request failed. Check network connectivity and try again.",
    });
  }
});

export default router;

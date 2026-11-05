import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { getCachedSession, setCachedSession } from "../lib/curlFetch.js";

// Attach the Better Auth session to req; reject unauthenticated requests
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ── Session cache: avoid a DB query on every request ──────────────────
    // Extract the session token from the cookie so we can cache lookups.
    // Better Auth sets the cookie as "better-auth.session_token=<token>...."
    const cookieHeader = req.headers.cookie ?? "";
    const tokenMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
    const rawToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    // The actual token is the part before the first "." (Better Auth format)
    const cacheKey = rawToken ? rawToken.split(".")[0] : null;

    if (cacheKey) {
      const cached = getCachedSession(cacheKey);
      if (cached) {
        (req as Request & { user: typeof cached }).user = cached;
        return next();
      }
    }

    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });

    if (!session?.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Cache for 30 seconds
    if (cacheKey) setCachedSession(cacheKey, session.user);
    (req as Request & { user: typeof session.user }).user = session.user;
    next();
  } catch (error: unknown) {
    next(error);
  }
}

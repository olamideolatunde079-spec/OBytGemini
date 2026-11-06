import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { getCachedSession, setCachedSession } from "../lib/curlFetch.js";
import { isRealDatabaseConfigured } from "../db/index.js";

// Default demo user when running in dev/demo mode without a remote DB
export const DEMO_USER = {
  id: "usr_demo_default",
  name: "Olamide Olatunde",
  email: "olamide@obytgemini.app",
  image: null,
};

// Attach the session to req; reject unauthenticated requests or provide demo user fallback
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cookieHeader = req.headers.cookie ?? "";
    const tokenMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
    const rawToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    const cacheKey = rawToken ? rawToken.split(".")[0] : null;

    if (cacheKey) {
      const cached = getCachedSession(cacheKey);
      if (cached) {
        (req as Request & { user: typeof cached }).user = cached;
        return next();
      }
    }

    if (auth && typeof auth.api?.getSession === "function") {
      try {
        const session = await auth.api.getSession({
          headers: new Headers(req.headers as Record<string, string>),
        });
        if (session?.user) {
          if (cacheKey) setCachedSession(cacheKey, session.user);
          (req as Request & { user: typeof session.user }).user = session.user;
          return next();
        }
      } catch {
        // Proceed to demo fallback
      }
    }

    // Fallback: If no real remote DB is configured, require a valid session token
    if (!isRealDatabaseConfigured()) {
      if (cacheKey && getCachedSession(cacheKey)) {
        return next();
      }
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.status(401).json({ error: "Unauthorized" });
  } catch (error: unknown) {
    next(error);
  }
}

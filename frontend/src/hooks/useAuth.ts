import { useState, useEffect, useCallback } from "react";
import { getSession, signOut as authSignOut, type SessionUser } from "../lib/auth-client.js";

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getSession();
      setUser(s?.user ?? null);
    } catch (err: unknown) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Could not check the session.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await authSignOut();
    // authSignOut redirects to /signin — no local state update needed
  }, []);

  return { user, loading, error, signOut, refresh };
}

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
      // Retry up to 3 times with 2s delay — handles backend cold starts
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const s = await getSession();
          setUser(s?.user ?? null);
          return;
        } catch (err: unknown) {
          lastError = err;
          if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
      }
      // All retries failed — set user to null, show error
      setUser(null);
      if (lastError instanceof Error && lastError.message !== "Could not check the session.") {
        setError("Could not connect to the server. Make sure the backend is running on port 5000.");
      }
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

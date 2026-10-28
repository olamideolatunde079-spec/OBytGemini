// Better Auth browser client — talks to the backend /api/auth/* endpoints.
// Vite proxies /api → http://localhost:5000, so these work in both dev and
// production (as long as VITE_API_URL is configured for prod).

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  user: SessionUser;
  session: { id: string; expiresAt: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.message ?? data?.error ?? `HTTP ${res.status}`
    );
  }
  return data as T;
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function getSession(): Promise<Session | null> {
  const res = await fetch("/api/auth/get-session", {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Could not check the session (HTTP ${res.status}).`);
  }
  const data = await res.json();
  return data?.user ? (data as Session) : null;
}

// ── Email / Password ──────────────────────────────────────────────────────────
// Better Auth sign-up/sign-in return { token, user, redirect? } — not a full
// Session object. We only need the call to succeed (it sets the session cookie);
// the useAuth hook picks up the session via getSession() afterwards.

interface AuthResponse {
  token?: string;
  user?: SessionUser;
  redirect?: boolean;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiPost<AuthResponse>("/api/auth/sign-in/email", { email, password });
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiPost<AuthResponse>("/api/auth/sign-up/email", { name, email, password });
}

// ── Social providers ──────────────────────────────────────────────────────────
// Better Auth's social sign-in requires a POST to get the OAuth redirect URL,
// then we navigate the browser to that URL.

async function socialSignIn(provider: "github" | "google"): Promise<void> {
  const data = await apiPost<{ url: string; redirect: boolean }>(
    "/api/auth/sign-in/social",
    {
      provider,
      callbackURL: `${window.location.origin}/`,
    }
  );
  if (data.url) {
    window.location.href = data.url;
  }
}

export const signInWithGitHub = () => socialSignIn("github");
export const signInWithGoogle = () => socialSignIn("google");

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await apiPost("/api/auth/sign-out");
  window.location.href = "/signin";
}

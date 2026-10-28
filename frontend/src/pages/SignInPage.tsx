import { useState, useEffect, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faGoogle } from "@fortawesome/free-brands-svg-icons";
import {
  faEnvelope,
  faLock,
  faUser,
  faEye,
  faEyeSlash,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGitHub,
  signInWithGoogle,
} from "../lib/auth-client.js";

type Mode = "signin" | "signup";

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<"github" | "google" | null>(null);

  // Google is shown only when backend has it configured.
  const [hasGoogle, setHasGoogle] = useState(false);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setHasGoogle(d?.auth?.google ?? false);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        if (!name.trim()) {
          setError("Please enter your name.");
          return;
        }
        if (password.length < 12) {
          setError("Use a password with at least 12 characters.");
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        await signUpWithEmail(name.trim(), email, password);
      }
      // Full page reload so App.tsx re-mounts and useAuth picks up the
      // session cookie. (useAuth is local state per-component, so a
      // client-side navigate wouldn't update App's copy.)
      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGitHub = async () => {
    setSocialLoading("github");
    try {
      await signInWithGitHub();
      // GitHub redirects the browser — no further action needed here
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "GitHub sign-in failed");
      setSocialLoading(null);
    }
  };

  const handleGoogle = async () => {
    setSocialLoading("google");
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setSocialLoading(null);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">O</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">OBytGemini</h1>
          <p className="text-sm text-gray-500 mt-1">Multi-provider AI assistant</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            {mode === "signin" ? "Welcome back" : "Create an account"}
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            {mode === "signin"
              ? "Sign in to continue your conversations."
              : "Sign up to start chatting with AI."}
          </p>

          {/* Social buttons */}
          <div className="flex flex-col gap-2 mb-5">
            <button
              onClick={handleGitHub}
              disabled={!!socialLoading || loading}
              className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium text-sm transition-colors disabled:opacity-60"
            >
              <FontAwesomeIcon icon={faGithub} className="w-4 h-4" />
              {socialLoading === "github" ? "Redirecting…" : "Continue with GitHub"}
            </button>

            {hasGoogle && (
              <button
                onClick={handleGoogle}
                disabled={!!socialLoading || loading}
                className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-sm transition-colors disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faGoogle} className="w-4 h-4 text-red-500" />
                {socialLoading === "google" ? "Redirecting…" : "Continue with Google"}
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <FontAwesomeIcon
                  icon={faUser}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5"
                />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                />
              </div>
            )}

            <div className="relative">
              <FontAwesomeIcon
                icon={faEnvelope}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
              />
            </div>

            <div className="relative">
              <FontAwesomeIcon
                icon={faLock}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5"
              />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 12 : undefined}
                maxLength={128}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-3.5 h-3.5" />
              </button>
            </div>

            {mode === "signup" && (
              <div className="relative">
                <FontAwesomeIcon
                  icon={faLock}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !!socialLoading}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {mode === "signin" ? "Signing in…" : "Creating account…"}
                </span>
              ) : (
                <>
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                </>
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-sm text-gray-500 mt-5">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={toggleMode}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

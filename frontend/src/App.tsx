import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import AppShell from "./components/AppShell.js";
import SignInPage from "./pages/SignInPage.js";
import OnboardingPage from "./pages/OnboardingPage.js";
import ChatPage from "./pages/ChatPage.js";
import { useOutletContext } from "react-router-dom";

// Lazy-load non-essential pages — reduces initial bundle and speeds up startup
const LibraryPage = lazy(() => import("./pages/LibraryPage.js"));
const ImagesPage = lazy(() => import("./pages/ImagesPage.js"));
const ScheduledPage = lazy(() => import("./pages/ScheduledPage.js"));
const StudyPage = lazy(() => import("./pages/StudyPage.js"));
const CustomisePage = lazy(() => import("./pages/CustomisePage.js"));
const NotebookPage = lazy(() => import("./pages/NotebookPage.js"));

function CustomisePageWrapper() {
  const { theme, onThemeToggle } = useOutletContext<{ theme: "light" | "dark"; onThemeToggle: () => void }>();
  return <CustomisePage theme={theme} onThemeToggle={onThemeToggle} />;
}

// Lightweight loading fallback for lazy pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div
        className="w-6 h-6 rounded-full animate-spin"
        style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent-blue)" }}
      />
    </div>
  );
}

export default function App() {
  const { user, loading, error, refresh } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-4">
          <img
            src="/images/obytgemini-logo.png"
            alt="OBytGemini"
            className="w-16 h-16 object-contain"
            style={{ animation: "pulse 1.5s ease-in-out infinite" }}
          />
          <p className="text-sm font-medium tracking-wide" style={{ color: "var(--text-secondary)" }}>
            OBytGemini
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg-base)" }}>
        <div className="max-w-sm text-center">
          <p role="alert" className="text-sm" style={{ color: "var(--error-text)" }}>{error}</p>
          <button
            onClick={refresh}
            className="mt-4 rounded-full px-5 py-2 text-sm font-medium transition-colors"
            style={{ background: "var(--accent-blue)", color: "var(--text-inverse)" }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Onboarding page for first-time visitors */}
      <Route path="/welcome" element={<OnboardingPage />} />

      {/* Sign-in page (redirects to / if already authed) */}
      <Route
        path="/signin"
        element={user ? <Navigate to="/" replace /> : <SignInPage />}
      />

      {/* Main app — requires auth */}
      <Route
        path="/"
        element={user ? <AppShell /> : <Navigate to="/welcome" replace />}
      >
        <Route index element={<ChatPage />} />
        <Route path="chat/:chatId" element={<ChatPage />} />
        <Route path="library" element={<Suspense fallback={<PageLoader />}><LibraryPage /></Suspense>} />
        <Route path="images" element={<Suspense fallback={<PageLoader />}><ImagesPage /></Suspense>} />
        <Route path="scheduled" element={<Suspense fallback={<PageLoader />}><ScheduledPage /></Suspense>} />
        <Route path="study" element={<Suspense fallback={<PageLoader />}><StudyPage /></Suspense>} />
        <Route path="customise" element={<Suspense fallback={<PageLoader />}><CustomisePageWrapper /></Suspense>} />
        <Route path="notebook/:notebookId" element={<Suspense fallback={<PageLoader />}><NotebookPage /></Suspense>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

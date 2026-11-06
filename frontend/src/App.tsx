import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import AppShell from "./components/AppShell.js";
import SignInPage from "./pages/SignInPage.js";
import ChatPage from "./pages/ChatPage.js";
import LibraryPage from "./pages/LibraryPage.js";
import ImagesPage from "./pages/ImagesPage.js";
import ScheduledPage from "./pages/ScheduledPage.js";
import StudyPage from "./pages/StudyPage.js";
import CustomisePage from "./pages/CustomisePage.js";
import NotebookPage from "./pages/NotebookPage.js";
import { useOutletContext } from "react-router-dom";

function CustomisePageWrapper() {
  const { theme, onThemeToggle } = useOutletContext<{ theme: "light" | "dark"; onThemeToggle: () => void }>();
  return <CustomisePage theme={theme} onThemeToggle={onThemeToggle} />;
}

export default function App() {
  const { user, loading, error, refresh } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#101114]">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/images/obytgemini-logo.png"
            alt="OBytGemini"
            aria-hidden="true"
            className="w-12 h-12 object-contain animate-pulse"
          />
          <p className="text-sm text-[#AEB4BE]">Loading OBytGemini…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101114] px-4">
        <div className="max-w-sm text-center">
          <p role="alert" className="text-sm text-red-400">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 rounded-full bg-[#8AB4F8] px-5 py-2 text-sm font-medium text-[#101114] hover:bg-[#a8c7fa] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Sign-in page (redirects to / if already authed) */}
      <Route
        path="/signin"
        element={user ? <Navigate to="/" replace /> : <SignInPage />}
      />

      {/* Main app — requires auth */}
      <Route
        path="/"
        element={user ? <AppShell /> : <Navigate to="/signin" replace />}
      >
        <Route index element={<ChatPage />} />
        <Route path="chat/:chatId" element={<ChatPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="images" element={<ImagesPage />} />
        <Route path="scheduled" element={<ScheduledPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="customise" element={<CustomisePageWrapper />} />
        <Route path="notebook/:notebookId" element={<NotebookPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

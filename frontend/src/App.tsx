import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import AppShell from "./components/AppShell.js";
import SignInPage from "./pages/SignInPage.js";
import ChatPage from "./pages/ChatPage.js";

export default function App() {
  const { user, loading, error, refresh } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 animate-pulse" />
          <p className="text-sm text-gray-500">Loading OBytGemini…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <p role="alert" className="text-sm text-red-600">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

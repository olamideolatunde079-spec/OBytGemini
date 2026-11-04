import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.js";
import type { Chat } from "../types/index.js";
import { fetchChats } from "../lib/api.js";

function getSavedTheme(): "light" | "dark" {
  try {
    const t = window.localStorage.getItem("obytgemini-theme");
    return t === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(getSavedTheme);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatsError, setChatsError] = useState<string | null>(null);

  /* Apply theme to <html> */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { window.localStorage.setItem("obytgemini-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  /* Collapse sidebar on small screens by default */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    if (mq.matches) setSidebarOpen(false);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const refreshChats = useCallback(async () => {
    try {
      const list = await fetchChats();
      setChats(list);
      setChatsError(null);
    } catch (err: unknown) {
      setChatsError(err instanceof Error ? err.message : "Could not load chats.");
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => { refreshChats(); }, [refreshChats]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        theme={theme}
        onThemeToggle={toggleTheme}
        chats={chats}
        loadingChats={loadingChats}
        chatsError={chatsError}
        onChatsChanged={refreshChats}
      />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Outlet context={{ refreshChats, sidebarOpen, onToggleSidebar: () => setSidebarOpen(o => !o) }} />
      </main>
    </div>
  );
}

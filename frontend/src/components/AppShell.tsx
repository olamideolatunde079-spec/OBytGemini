import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.js";
import type { Chat } from "../types/index.js";
import { fetchChats } from "../lib/api.js";

function getSavedTheme(): "light" | "dark" {
  try {
    return window.localStorage.getItem("obytgemini-theme") === "dark"
      ? "dark"
      : "light";
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem("obytgemini-theme", theme);
    } catch {
      console.warn("Theme preference could not be saved in this browser.");
    }
  }, [theme]);

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

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        theme={theme}
        onThemeToggle={() =>
          setTheme((current) => (current === "dark" ? "light" : "dark"))
        }
        chats={chats}
        loadingChats={loadingChats}
        chatsError={chatsError}
        onChatsChanged={refreshChats}
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet context={{ refreshChats }} />
      </main>
    </div>
  );
}

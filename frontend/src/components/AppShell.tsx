import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.js";
import MobileHeader from "./MobileHeader.js";
import type { Chat } from "../types/index.js";
import { fetchChats, createChat } from "../lib/api.js";

function getSavedTheme(): "light" | "dark" {
  try {
    const t = window.localStorage.getItem("obytgemini-theme");
    return t === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export default function AppShell() {
  const navigate = useNavigate();
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

  /* Prevent body scroll when mobile drawer is open */
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

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

  const toggleSidebar = () => setSidebarOpen(o => !o);

  /* New-chat handler used by both sidebar and mobile header */
  const handleNewChat = useCallback(async () => {
    try {
      const chat = await createChat();
      refreshChats();
      navigate(`/chat/${chat.id}`);
    } catch {
      navigate("/");
    }
    // Close sidebar on mobile after navigation
    if (window.matchMedia("(max-width: 768px)").matches) {
      setSidebarOpen(false);
    }
  }, [navigate, refreshChats]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Sidebar drawer (desktop: push-layout | mobile: overlay) ── */}
      <Sidebar
        open={sidebarOpen}
        onToggle={toggleSidebar}
        theme={theme}
        onThemeToggle={toggleTheme}
        chats={chats}
        loadingChats={loadingChats}
        chatsError={chatsError}
        onChatsChanged={refreshChats}
      />

      {/* ── Mobile backdrop — tap outside drawer to close ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Main content column ── */}
      <main
        className="flex-1 flex flex-col overflow-hidden min-w-0"
        // Keeps content behind the drawer on mobile but scrollable
      >
        {/*
          ── Global mobile header ──
          Rendered here (above Outlet) so EVERY page automatically has it.
          Hidden on md+ (Sidebar handles its own toggle on desktop).
        */}
        <MobileHeader
          onToggleSidebar={toggleSidebar}
          onNewChat={handleNewChat}
        />

        {/* ── Page content (all routes render here) ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Outlet
            context={{
              refreshChats,
              sidebarOpen,
              onToggleSidebar: toggleSidebar,
              theme,
              onThemeToggle: toggleTheme,
            }}
          />
        </div>
      </main>
    </div>
  );
}

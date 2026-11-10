/**
 * AppShell — root layout wrapper for all authenticated pages.
 *
 * Owns:
 *  - Sidebar open/close state
 *  - Theme state
 *  - Chat list (passed into Sidebar)
 *  - Mobile header (MobileHeader component rendered above Outlet)
 *  - Model context state (lifted from ChatPage via onModelContextChange in Outlet context)
 *    so MobileHeader can display and change the current model on mobile.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.js";
import MobileHeader from "./MobileHeader.js";
import type { Chat, ModelInfo } from "../types/index.js";
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

  /* ── Model context — lifted from ChatPage so MobileHeader can show/change model ── */
  const [headerModels, setHeaderModels] = useState<ModelInfo[]>([]);
  const [headerProvider, setHeaderProvider] = useState("groq");
  const [headerModel, setHeaderModel] = useState("openai/gpt-oss-20b");
  // Callback ref: ChatPage calls this to sync its model state up to AppShell
  const externalModelChangeRef = useRef<((p: string, m: string) => void) | null>(null);

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

  /* New-chat handler used by both Sidebar and MobileHeader */
  const handleNewChat = useCallback(async () => {
    try {
      const chat = await createChat();
      refreshChats();
      navigate(`/chat/${chat.id}`);
    } catch {
      navigate("/");
    }
    if (window.matchMedia("(max-width: 768px)").matches) {
      setSidebarOpen(false);
    }
  }, [navigate, refreshChats]);

  /**
   * Called by MobileHeader when user picks a model from the compact selector.
   * Forwards the change to ChatPage via the externalModelChangeRef.
   */
  const handleHeaderModelChange = useCallback((p: string, m: string) => {
    setHeaderProvider(p);
    setHeaderModel(m);
    // Forward to ChatPage's handleModelChange
    externalModelChangeRef.current?.(p, m);
  }, []);

  /**
   * Passed to ChatPage via Outlet context.
   * ChatPage calls this whenever its model state changes (load, user select, chat load).
   */
  const onModelContextChange = useCallback((
    models: ModelInfo[],
    provider: string,
    model: string,
    changeCallback: (p: string, m: string) => void
  ) => {
    setHeaderModels(models);
    setHeaderProvider(provider);
    setHeaderModel(model);
    externalModelChangeRef.current = changeCallback;
  }, []);

  return (
    <div
      className="flex overflow-hidden"
      style={{ background: "var(--bg-base)", height: "100dvh" }}
    >
      {/* ── Sidebar drawer ── */}
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

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Main content column ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/*
          Global mobile header — rendered above every page automatically.
          Hidden on md+ screens (Sidebar handles desktop navigation).
          Receives model context so it can show the compact model selector.
        */}
        <MobileHeader
          onToggleSidebar={toggleSidebar}
          onNewChat={handleNewChat}
          models={headerModels}
          provider={headerProvider}
          model={headerModel}
          onModelChange={handleHeaderModelChange}
        />

        {/* Page content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Outlet
            context={{
              refreshChats,
              sidebarOpen,
              onToggleSidebar: toggleSidebar,
              theme,
              onThemeToggle: toggleTheme,
              onModelContextChange,  // ChatPage uses this to sync model state up
            }}
          />
        </div>
      </main>
    </div>
  );
}

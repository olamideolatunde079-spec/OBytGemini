import { useState } from "react";
import { useNavigate, useParams, NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars, faXmark, faMagnifyingGlass, faMessage,
  faGear, faRightFromBracket, faTrash, faMoon, faSun,
  faChevronDown, faChevronUp, faPencil,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../hooks/useAuth.js";
import { createChat, deleteChat } from "../lib/api.js";
import MemoryPanel from "./MemoryPanel.js";
import type { Chat } from "../types/index.js";

interface Props {
  open: boolean;
  onToggle: () => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  chats: Chat[];
  loadingChats: boolean;
  chatsError: string | null;
  onChatsChanged: () => void;
}

export default function Sidebar({
  open, onToggle, theme, onThemeToggle,
  chats, loadingChats, chatsError, onChatsChanged,
}: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const filtered = chats.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  /* ── helpers ── */
  const closeOnMobile = () => {
    if (window.matchMedia("(max-width:767px)").matches) onToggle();
  };

  const handleNewChat = async () => {
    setActionError(null);
    try {
      const chat = await createChat();
      onChatsChanged();
      navigate(`/chat/${chat.id}`);
      closeOnMobile();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not create chat.");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    setDeletingId(id); setActionError(null);
    try {
      await deleteChat(id);
      onChatsChanged();
      if (chatId === id) navigate("/");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true); setActionError(null);
    try { await signOut(); }
    catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not sign out.");
      setLoggingOut(false);
    }
  };

  /* ── sidebar width ── */
  const sidebarW = open ? "w-64 md:w-72" : "w-0 md:w-14";

  return (
    <>
      {/* ── hamburger when fully closed on mobile ── */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed top-3.5 left-4 z-30 md:hidden p-2 rounded-full"
          style={{ background: "var(--bg-hover)" }}
          aria-label="Open sidebar"
        >
          <FontAwesomeIcon icon={faBars} className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
        </button>
      )}

      <aside
        className={`
          ${sidebarW}
          fixed md:relative inset-y-0 left-0 z-30
          flex flex-col overflow-hidden
          transition-all duration-200 ease-in-out
        `}
        style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-light)" }}
      >
        {/* ── top row ── */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-2 flex-shrink-0">
          {/* hamburger/close */}
          <button
            onClick={onToggle}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            <FontAwesomeIcon icon={open ? faXmark : faBars} className="w-4 h-4" />
          </button>

          {/* Logo — only when open */}
          {open && (
            <img
              src="/images/obytgemini-logo-alt.png"
              alt="OBytGemini"
              className="h-7 object-contain object-left ml-1"
              style={{ maxWidth: 160 }}
            />
          )}
        </div>

        {/* ── new chat ── */}
        <div className="px-2 pb-2 flex-shrink-0">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            title="New Chat"
          >
            <FontAwesomeIcon icon={faPencil} className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-secondary)" }} />
            {open && <span className="sidebar-label">New chat</span>}
          </button>
        </div>

        {/* ── search ── */}
        {open && (
          <div className="px-3 pb-2 flex-shrink-0">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm"
              style={{ background: "var(--bg-hover)" }}
            >
              <FontAwesomeIcon icon={faMagnifyingGlass} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search chats"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
          </div>
        )}

        {/* ── chat list ── */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {open && (
            <>
              {chatsError && (
                <p className="px-3 py-2 text-xs" style={{ color: "var(--error-text)" }}>{chatsError}</p>
              )}
              {loadingChats && !chatsError && (
                <div className="space-y-1 px-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-9 rounded-xl animate-pulse" style={{ background: "var(--bg-hover)" }} />
                  ))}
                </div>
              )}
              {!loadingChats && filtered.length === 0 && (
                <p className="px-4 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                  {search ? "No chats match your search." : "No chats yet. Start a new one!"}
                </p>
              )}
              {!loadingChats && filtered.length > 0 && (
                <>
                  <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Recent
                  </p>
                  <ul>
                    {filtered.map(c => (
                      <li key={c.id}>
                        <NavLink
                          to={`/chat/${c.id}`}
                          onClick={closeOnMobile}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors group"
                          style={({ isActive }) => ({
                            background: isActive ? "var(--bg-active)" : "transparent",
                            color: "var(--text-primary)",
                          })}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement;
                            if (!el.dataset.active) el.style.background = "var(--bg-hover)";
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement;
                            if (!el.dataset.active) el.style.background = "transparent";
                          }}
                        >
                          <FontAwesomeIcon icon={faMessage} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                          <span className="flex-1 truncate">{c.title}</span>
                          <button
                            onClick={e => handleDelete(e, c.id)}
                            disabled={deletingId === c.id}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "var(--error-text)")}
                            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                            aria-label="Delete chat"
                          >
                            <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                          </button>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {/* Collapsed: just icons */}
          {!open && (
            <div className="flex flex-col items-center gap-1 py-1">
              {chats.slice(0, 6).map(c => (
                <NavLink
                  key={c.id}
                  to={`/chat/${c.id}`}
                  title={c.title}
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <FontAwesomeIcon icon={faMessage} className="w-4 h-4" />
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* ── footer ── */}
        <div className="flex-shrink-0 px-2 pb-3 space-y-0.5" style={{ borderTop: "1px solid var(--border-light)" }}>
          {/* Settings toggle */}
          <button
            onClick={() => setSettingsOpen(s => !s)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            aria-expanded={settingsOpen}
            title="Settings"
          >
            <FontAwesomeIcon icon={faGear} className="w-4 h-4 flex-shrink-0" />
            {open && (
              <>
                <span className="flex-1 text-left sidebar-label">Settings</span>
                <FontAwesomeIcon icon={settingsOpen ? faChevronUp : faChevronDown} className="w-3 h-3" />
              </>
            )}
          </button>

          {/* Settings panel */}
          {open && settingsOpen && (
            <div className="mx-2 mb-1 rounded-xl p-3 space-y-3" style={{ background: "var(--bg-hover)" }}>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Appearance</p>
                <button
                  onClick={onThemeToggle}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} className="w-4 h-4" style={{ color: "var(--brand-1)" }} />
                  {theme === "dark" ? "Light theme" : "Dark theme"}
                </button>
              </div>
              <MemoryPanel />
            </div>
          )}

          {actionError && open && (
            <p className="px-3 py-1 text-xs" style={{ color: "var(--error-text)" }}>{actionError}</p>
          )}

          {/* User row */}
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ color: "var(--text-primary)" }}>
              {user.image ? (
                <img src={user.image} alt={user.name} className="w-7 h-7 rounded-full flex-shrink-0 object-cover" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              {open && (
                <>
                  <span className="flex-1 text-sm truncate sidebar-label">{user.name}</span>
                  <button
                    onClick={handleSignOut}
                    disabled={loggingOut}
                    className="p-1.5 rounded-full transition-colors flex-shrink-0"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--error-text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

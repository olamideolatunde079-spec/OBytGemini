import { useState } from "react";
import { useNavigate, useParams, NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faXmark,
  faPlus,
  faMagnifyingGlass,
  faMessage,
  faGear,
  faRightFromBracket,
  faTrash,
  faMoon,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../hooks/useAuth.js";
import { createChat, deleteChat } from "../lib/api.js";
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
  open,
  onToggle,
  theme,
  onThemeToggle,
  chats,
  loadingChats,
  chatsError,
  onChatsChanged,
}: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleNewChat = async () => {
    setActionError(null);
    try {
      const chat = await createChat();
      onChatsChanged();
      navigate(`/chat/${chat.id}`);
      closeDrawerOnMobile();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not create chat.");
    }
  };

  const closeDrawerOnMobile = () => {
    if (open && window.matchMedia("(max-width: 767px)").matches) onToggle();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    setActionError(null);
    try {
      await deleteChat(id);
      onChatsChanged();
      if (chatId === id) navigate("/");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not delete chat.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    setActionError(null);
    try {
      await signOut();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not sign out.");
      setLoggingOut(false);
    }
  };

  return (
    <>
      {/* Toggle button when sidebar is closed */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-30 p-2 rounded-lg hover:bg-gray-200 text-gray-600"
          aria-label="Open sidebar"
        >
          <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
        </button>
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-30
          flex flex-col bg-white border-r border-gray-200
          transition-all duration-200 ease-in-out
          ${open ? "w-72" : "w-0 overflow-hidden"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <img
            src="/images/obytgemini-logo-alt.png"
            alt="OBytGemini"
            className="h-10 w-48 object-contain object-left"
          />
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            aria-label="Close sidebar"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-3 pt-3">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 font-medium text-sm transition-colors group"
          >
            <FontAwesomeIcon icon={faPlus} className="text-indigo-500 group-hover:text-indigo-600 w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-gray-400 w-3 h-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search chats…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2">
          {chatsError ? (
            <p role="alert" className="px-3 py-2 text-xs text-red-600">
              {chatsError}
            </p>
          ) : loadingChats ? (
            <div className="px-3 py-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-lg mb-2 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-6 px-4">
              {search ? "No chats match your search." : "No chats yet. Start a new one!"}
            </p>
          ) : (
            <ul>
              {filtered.map((c) => (
                <li key={c.id}>
                  <NavLink
                    to={`/chat/${c.id}`}
                    onClick={closeDrawerOnMobile}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group ${
                        isActive
                          ? "bg-indigo-50 text-indigo-800 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`
                    }
                  >
                    <FontAwesomeIcon icon={faMessage} className="flex-shrink-0 text-gray-400 w-3 h-3" />
                    <span className="flex-1 truncate">{c.title}</span>
                    <button
                      onClick={(e) => handleDelete(e, c.id)}
                      disabled={deletingId === c.id}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 text-gray-400 transition-opacity"
                      aria-label="Delete chat"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                    </button>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          <button
            onClick={() => setSettingsOpen((current) => !current)}
            aria-expanded={settingsOpen}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-600 text-sm transition-colors"
          >
            <FontAwesomeIcon icon={faGear} className="w-3.5 h-3.5" />
            Settings
          </button>
          {settingsOpen && (
            <section aria-label="Settings" className="rounded-lg bg-gray-50 p-3">
              <p className="mb-2 text-xs font-medium text-gray-500">Appearance</p>
              <button
                onClick={onThemeToggle}
                className="flex items-center gap-2 text-sm text-gray-700"
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                aria-pressed={theme === "dark"}
              >
                <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} className="w-3.5 h-3.5" />
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </button>
            </section>
          )}
          {actionError && (
            <p role="alert" className="px-3 py-1 text-xs text-red-600">
              {actionError}
            </p>
          )}
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2">
              {user.image ? (
                <img src={user.image} alt={user.name} className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 text-sm text-gray-700 truncate">{user.name}</span>
              <button
                onClick={handleSignOut}
                disabled={loggingOut}
                className="p-1 rounded hover:text-red-500 text-gray-400 disabled:opacity-50"
                aria-label="Sign out"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

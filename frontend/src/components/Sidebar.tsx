import { useState, useEffect } from "react";
import { useNavigate, useParams, NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faTableCellsLarge,
  faImage,
  faClock,
  faGraduationCap,
  faSliders,
  faPlus,
  faFilter,
  faMagnifyingGlass,
  faTableColumns,
  faGear,
  faTrash,
  faPencil,
  faEllipsisVertical,
  faBookBookmark,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../hooks/useAuth.js";
import {
  createChat,
  deleteChat,
  updateChat,
  fetchNotebooks,
  createNotebook,
  deleteNotebook,
} from "../lib/api.js";
import SearchDialog from "./SearchDialog.js";
import type { Chat, Notebook } from "../types/index.js";

interface SidebarProps {
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
  chats,
  loadingChats,
  chatsError,
  onChatsChanged,
}: SidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState("");

  // Load notebooks
  useEffect(() => {
    fetchNotebooks()
      .then(setNotebooks)
      .catch(() => {});
  }, []);

  const closeOnMobile = () => {
    if (window.matchMedia("(max-width: 768px)").matches) onToggle();
  };

  const handleNewChat = async () => {
    try {
      const chat = await createChat();
      onChatsChanged();
      navigate(`/chat/${chat.id}`);
      closeOnMobile();
    } catch {
      navigate("/");
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuChatId(null);
    try {
      await deleteChat(id);
      onChatsChanged();
      if (chatId === id) navigate("/");
    } catch {
      // ignore
    }
  };

  const handleRenameChat = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editingTitle.trim()) return;
    try {
      await updateChat(id, { title: editingTitle.trim() });
      onChatsChanged();
      setEditingChatId(null);
    } catch {
      // ignore
    }
  };

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookTitle.trim()) return;
    try {
      const nb = await createNotebook({ title: newNotebookTitle.trim() });
      setNotebooks((prev) => [nb, ...prev]);
      setCreatingNotebook(false);
      setNewNotebookTitle("");
      navigate(`/notebook/${nb.id}`);
      closeOnMobile();
    } catch {
      // ignore
    }
  };

  const handleDeleteNotebook = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteNotebook(id);
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // ignore
    }
  };

  const navLinks = [
    { label: "Library", path: "/library", icon: faTableCellsLarge },
    { label: "Images", path: "/images", icon: faImage },
    { label: "Scheduled", path: "/scheduled", icon: faClock },
    { label: "Students", path: "/study", icon: faGraduationCap },
    { label: "Customise", path: "/customise", icon: faSliders },
  ];

  const sidebarWidth = open ? "w-[260px]" : "w-0 md:w-16";

  return (
    <>
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        chats={chats}
        notebooks={notebooks}
      />

      <aside
        className={`
          ${sidebarWidth}
          fixed md:relative inset-y-0 left-0 z-30
          flex flex-col overflow-hidden
          transition-all duration-200 ease-in-out
          border-r select-none
        `}
        style={{
          background: "var(--bg-sidebar)",
          borderColor: "var(--border)",
        }}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2 shrink-0">
          {open ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/images/obytgemini-logo.png"
                alt="OBytGemini"
                className="w-5 h-5 object-contain shrink-0"
              />
              <span className="font-medium text-base tracking-tight text-[var(--text-primary)] truncate">
                OBytGemini
              </span>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <img
                src="/images/obytgemini-logo.png"
                alt="OBytGemini"
                className="w-5 h-5 object-contain"
              />
            </div>
          )}

          {open && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                title="Search (Ctrl+K)"
                aria-label="Search conversations"
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggle}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <FontAwesomeIcon icon={faTableColumns} className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <div className="px-3 pt-2 pb-1.5 shrink-0">
          <button
            onClick={handleNewChat}
            className={`
              flex items-center gap-3 w-full py-2.5 px-3.5 rounded-full text-sm font-medium
              bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]
              transition-colors border border-white/5 shadow-xs
              ${!open ? "justify-center px-0" : ""}
            `}
            title="New chat"
          >
            <FontAwesomeIcon
              icon={faPenToSquare}
              className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0"
            />
            {open && <span className="truncate">New chat</span>}
          </button>
        </div>

        {/* Primary Navigation Links */}
        <div className="px-2 py-1 shrink-0 space-y-0.5">
          {navLinks.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeOnMobile}
              className={({ isActive }) => `
                flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm transition-colors
                ${!open ? "justify-center px-0" : ""}
                ${
                  isActive
                    ? "bg-[var(--bg-active)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }
              `}
              title={item.label}
            >
              <FontAwesomeIcon
                icon={item.icon}
                className="w-4 h-4 shrink-0 text-[var(--text-muted)]"
              />
              {open && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Notebooks Section */}
        {open && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1 mb-1">
              <span>Notebooks</span>
            </div>
            <button
              onClick={() => setCreatingNotebook((v) => !v)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} className="w-3 h-3 text-[var(--text-muted)]" />
              <span>New notebook</span>
            </button>

            {creatingNotebook && (
              <form onSubmit={handleCreateNotebook} className="mt-1 px-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Notebook title..."
                  value={newNotebookTitle}
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--bg-surface)] border border-white/10 text-xs text-[var(--text-primary)] outline-none"
                />
              </form>
            )}

            {notebooks.length > 0 && (
              <div className="space-y-0.5 mt-1 max-h-24 overflow-y-auto">
                {notebooks.map((nb) => (
                  <NavLink
                    key={nb.id}
                    to={`/notebook/${nb.id}`}
                    onClick={closeOnMobile}
                    className={({ isActive }) => `
                      group flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-colors
                      ${
                        isActive
                          ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FontAwesomeIcon
                        icon={faBookBookmark}
                        className="w-3 h-3 text-[#8AB4F8] shrink-0"
                      />
                      <span className="truncate">{nb.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteNotebook(e, nb.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-red-400 transition-opacity"
                      title="Delete notebook"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-2.5 h-2.5" />
                    </button>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
          {open && (
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-2 mb-1.5">
              <span>All</span>
              <button
                onClick={() => setSearchOpen(true)}
                className="hover:text-[var(--text-primary)] transition-colors p-1"
                title="Filter conversations"
              >
                <FontAwesomeIcon icon={faFilter} className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {open && chatsError && (
            <p className="px-2 py-1 text-xs text-red-400">{chatsError}</p>
          )}

          {open && loadingChats && (
            <div className="space-y-1.5 px-1 py-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-7 rounded-lg animate-pulse bg-[var(--bg-hover)]"
                />
              ))}
            </div>
          )}

          {open && !loadingChats && chats.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-[var(--text-muted)]">
              No conversations yet
            </p>
          )}

          {open && (
            <div className="space-y-0.5">
              {chats.map((c) => {
                const isActive = chatId === c.id;
                const isEditing = editingChatId === c.id;

                if (isEditing) {
                  return (
                    <form
                      key={c.id}
                      onSubmit={(e) => handleRenameChat(e, c.id)}
                      className="px-2 py-1"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => setEditingChatId(null)}
                        className="w-full px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--accent-blue)] text-xs text-[var(--text-primary)] outline-none"
                      />
                    </form>
                  );
                }

                return (
                  <div key={c.id} className="relative group">
                    <NavLink
                      to={`/chat/${c.id}`}
                      onClick={closeOnMobile}
                      className={`
                        flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors
                        ${
                          isActive
                            ? "bg-[var(--bg-active)] text-[var(--text-primary)] font-medium"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        }
                      `}
                    >
                      <span className="truncate flex-1 pr-1">{c.title}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveMenuChatId((curr) => (curr === c.id ? null : c.id));
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-opacity"
                        aria-label="Chat options"
                      >
                        <FontAwesomeIcon icon={faEllipsisVertical} className="w-2.5 h-2.5" />
                      </button>
                    </NavLink>

                    {/* Context Menu */}
                    {activeMenuChatId === c.id && (
                      <div
                        className="absolute right-2 top-8 z-40 w-32 rounded-xl py-1 shadow-xl border border-white/10"
                        style={{ background: "var(--bg-surface)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingChatId(c.id);
                            setEditingTitle(c.title);
                            setActiveMenuChatId(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] text-left"
                        >
                          <FontAwesomeIcon icon={faPencil} className="w-3 h-3 text-[var(--text-muted)]" />
                          <span>Rename</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteChat(e, c.id)}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-[var(--bg-hover)] text-left"
                        >
                          <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsed view icons */}
          {!open && (
            <div className="flex flex-col items-center gap-2 py-2">
              <button
                onClick={onToggle}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                title="Expand sidebar"
              >
                <FontAwesomeIcon icon={faTableColumns} className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom User Profile Section */}
        <div
          className="shrink-0 p-2.5 border-t space-y-1.5"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            onClick={() => navigate("/customise")}
            className={`
              flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer hover:bg-[var(--bg-hover)] transition-colors
              ${!open ? "justify-center" : ""}
            `}
            title="Customise & Settings"
          >
            {/* User Avatar */}
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-white/10"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : "O"}
              </div>
            )}

            {open && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {user?.name || "Olamide Olatunde"}
                  </p>
                </div>
                <button
                  className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Settings"
                >
                  <FontAwesomeIcon icon={faGear} className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {open && (
            <button
              onClick={() => navigate("/customise")}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              }}
              title="Settings"
            >
              <FontAwesomeIcon icon={faGear} className="w-3.5 h-3.5 shrink-0" />
              <span>Settings</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

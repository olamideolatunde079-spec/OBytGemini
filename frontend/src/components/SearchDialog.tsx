import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faXmark,
  faMessage,
  faBookBookmark,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import type { Chat, Notebook, LibraryItem } from "../types/index.js";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  chats: Chat[];
  notebooks?: Notebook[];
  libraryItems?: LibraryItem[];
}

export default function SearchDialog({
  open,
  onClose,
  chats,
  notebooks = [],
  libraryItems = [],
}: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );
  const filteredNotebooks = notebooks.filter((n) =>
    n.title.toLowerCase().includes(query.toLowerCase())
  );
  const filteredLibrary = libraryItems.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const totalResults =
    filteredChats.length + filteredNotebooks.length + filteredLibrary.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-white/10"
        style={{ background: "var(--bg-surface)" }}
      >
        {/* Input bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="w-4 h-4 text-gray-400"
          />
          <input
            type="text"
            autoFocus
            placeholder="Search conversations, notebooks, and library..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-gray-500"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white transition-colors"
            aria-label="Close search"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {totalResults === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">
              {query ? "No results found." : "Type to start searching..."}
            </p>
          ) : (
            <>
              {filteredChats.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Conversations
                  </p>
                  {filteredChats.slice(0, 6).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        navigate(`/chat/${c.id}`);
                        onClose();
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <FontAwesomeIcon
                        icon={faMessage}
                        className="w-3.5 h-3.5 text-gray-400 shrink-0"
                      />
                      <span className="truncate flex-1">{c.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredNotebooks.length > 0 && (
                <div className="pt-2">
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Notebooks
                  </p>
                  {filteredNotebooks.slice(0, 4).map((nb) => (
                    <button
                      key={nb.id}
                      onClick={() => {
                        navigate(`/notebook/${nb.id}`);
                        onClose();
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <FontAwesomeIcon
                        icon={faBookBookmark}
                        className="w-3.5 h-3.5 text-[#8AB4F8] shrink-0"
                      />
                      <span className="truncate flex-1">{nb.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredLibrary.length > 0 && (
                <div className="pt-2">
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Library Items
                  </p>
                  {filteredLibrary.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(`/library`);
                        onClose();
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <FontAwesomeIcon
                        icon={faFolderOpen}
                        className="w-3.5 h-3.5 text-purple-400 shrink-0"
                      />
                      <span className="truncate flex-1">{item.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
          <span>Search OBytGemini</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}

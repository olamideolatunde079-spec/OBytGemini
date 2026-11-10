import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTableCellsLarge,
  faImage,
  faFileLines,
  faCode,
  faTrash,
  faDownload,
  faMagnifyingGlass,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { fetchLibraryItems, deleteLibraryItem, createLibraryItem } from "../lib/api.js";
import type { LibraryItem } from "../types/index.js";
import BackButton from "../components/BackButton.js";

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const loadItems = () => {
    setLoading(true);
    fetchLibraryItems()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteLibraryItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch {
      // ignore
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    try {
      const created = await createLibraryItem({
        title: noteTitle.trim(),
        type: "note",
        content: noteContent.trim(),
        tags: ["custom-note"],
      });
      setItems((prev) => [created, ...prev]);
      setNewNoteOpen(false);
      setNoteTitle("");
      setNoteContent("");
    } catch {
      // ignore
    }
  };

  const handleDownload = (item: LibraryItem) => {
    const a = document.createElement("a");
    if (item.type === "image" && item.previewUrl) {
      a.href = item.previewUrl;
      a.download = `${item.title.replace(/\s+/g, "_")}.png`;
    } else {
      const blob = new Blob([item.content], { type: "text/plain;charset=utf-8" });
      a.href = URL.createObjectURL(blob);
      a.download = `${item.title.replace(/\s+/g, "_")}.txt`;
    }
    a.click();
  };

  const filtered = items.filter((item) => {
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <BackButton fallback="/" label="Back" />
          <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Library
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Access, organize, and download your saved AI content, generated images, and documents.
          </p>
          </div>
        </div>
        <button
          onClick={() => setNewNoteOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 text-xs font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
          <span>New Note</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Items", icon: faTableCellsLarge },
            { id: "image", label: "Images", icon: faImage },
            { id: "document", label: "Documents", icon: faFileLines },
            { id: "code", label: "Code", icon: faCode },
            { id: "note", label: "Notes", icon: faFileLines },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`
                flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap
                ${
                  filterType === tab.id
                    ? "bg-[var(--bg-active)] text-white"
                    : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
                }
              `}
            >
              <FontAwesomeIcon icon={tab.icon} className="w-3 h-3" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3 h-3"
          />
          <input
            type="text"
            placeholder="Search saved items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-white/10 text-xs text-[var(--text-primary)] placeholder-gray-500 outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
      </div>

      {/* Grid of Items */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-[var(--bg-surface)] animate-pulse border border-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 px-4">
          <FontAwesomeIcon icon={faTableCellsLarge} className="w-10 h-10 text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-[var(--text-primary)]">No items found</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
            Save responses from your conversations, generate images, or click "New Note" to add items here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="group p-4 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-secondary)] border border-white/5 hover:border-white/15 transition-all cursor-pointer flex flex-col justify-between h-52 relative shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--accent-blue)]">
                    {item.type}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}
                      className="p-1 text-gray-400 hover:text-white"
                      title="Download"
                    >
                      <FontAwesomeIcon icon={faDownload} className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-1 text-gray-400 hover:text-red-400"
                      title="Delete"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-medium text-[var(--text-primary)] line-clamp-1 mb-2">
                  {item.title}
                </h4>

                {item.type === "image" && item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    className="w-full h-24 object-cover rounded-xl border border-white/10"
                  />
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-4 leading-relaxed font-mono">
                    {item.content}
                  </p>
                )}
              </div>

              <div className="text-[10px] text-[var(--text-muted)] pt-2 border-t border-white/5 flex items-center justify-between">
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                <span className="text-[#8AB4F8] opacity-0 group-hover:opacity-100 transition-opacity">
                  View →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Detail / Preview Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl rounded-2xl p-6 border border-white/10 max-h-[85vh] flex flex-col shadow-2xl"
            style={{ background: "var(--bg-surface)" }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div>
                <span className="text-xs uppercase font-medium text-[#8AB4F8]">
                  {selectedItem.type}
                </span>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {selectedItem.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedItem)}
                  className="px-3 py-1.5 rounded-full text-xs bg-white text-black hover:bg-white/90 font-medium"
                >
                  Download
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedItem.type === "image" && selectedItem.previewUrl ? (
                <img
                  src={selectedItem.previewUrl}
                  alt={selectedItem.title}
                  className="w-full rounded-xl max-h-[60vh] object-contain mx-auto"
                />
              ) : (
                <div className="text-xs leading-relaxed font-mono whitespace-pre-wrap text-[var(--text-primary)] bg-[var(--bg-surface-secondary)] p-4 rounded-xl border border-white/5">
                  {selectedItem.content}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Note Modal */}
      {newNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCreateNote}
            className="w-full max-w-lg rounded-2xl p-6 border border-white/10 shadow-2xl"
            style={{ background: "var(--bg-surface)" }}
          >
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">
              Create New Note
            </h3>
            <div className="space-y-3 mb-5">
              <input
                type="text"
                autoFocus
                placeholder="Note title..."
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none"
              />
              <textarea
                placeholder="Note content..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                required
                rows={6}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewNoteOpen(false)}
                className="px-4 py-2 rounded-full text-xs text-[var(--text-secondary)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-full text-xs bg-white text-black font-medium hover:bg-white/90"
              >
                Save Note
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

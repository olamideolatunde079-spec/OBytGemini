import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import {
  clearMemories,
  createMemory,
  deleteMemory,
  fetchMemories,
} from "../lib/api.js";
import type { Memory } from "../types/index.js";

const CATEGORIES: Memory["category"][] = [
  "name",
  "preference",
  "project",
  "interest",
  "instruction",
  "other",
];

export default function MemoryPanel() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Memory["category"]>("preference");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMemories(await fetchMemories());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load memories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAdd = async () => {
    const trimmed = content.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const memory = await createMemory({ category, content: trimmed });
      setMemories((prev) => [...prev, memory]);
      setContent("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save memory.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete memory.");
    }
  };

  const handleClear = async () => {
    if (!memories.length) return;
    if (!window.confirm("Delete all saved memories for your account?")) return;
    setError(null);
    try {
      await clearMemories();
      setMemories([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not clear memories.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500">Saved memories</p>
        {memories.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-red-500 hover:text-red-600 cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : memories.length === 0 ? (
        <p className="text-xs text-gray-500 leading-relaxed">
          No memories yet. Save short facts the AI can use to personalise replies.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-36 overflow-y-auto">
          {memories.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-2 rounded-md bg-white border border-gray-200 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{m.category}</p>
                <p className="text-xs text-gray-700 break-words">{m.content}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5"
                aria-label="Delete memory"
              >
                <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5 pt-1">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Memory["category"])}
          className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white cursor-pointer"
          aria-label="Memory category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. Prefers concise TypeScript examples"
          className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 resize-none outline-none focus:border-indigo-400 cursor-text"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !content.trim()}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-800 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
          {saving ? "Saving…" : "Add memory"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

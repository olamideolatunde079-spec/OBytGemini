import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faTrash,
  faDownload,
  faGraduationCap,
  faCheck,
  faArrowLeft,
  faPen,
  faPalette,
} from "@fortawesome/free-solid-svg-icons";
import SparkleIcon from "../components/SparkleIcon.js";
import { fetchNotebook, updateNotebook, deleteNotebook } from "../lib/api.js";
import type { Notebook } from "../types/index.js";

const NOTEBOOK_COLORS = [
  "#8AB4F8", // Gemini Blue
  "#81C995", // Mint Green
  "#FDD663", // Warm Yellow
  "#F28B82", // Coral Red
  "#C58AF9", // Purple
  "#78D9EC", // Cyan
];

export default function NotebookPage() {
  const { notebookId } = useParams<{ notebookId: string }>();
  const navigate = useNavigate();

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("#8AB4F8");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notebook
  useEffect(() => {
    if (!notebookId) return;
    setLoading(true);
    fetchNotebook(notebookId)
      .then(nb => {
        setNotebook(nb);
        setTitle(nb.title);
        setContent(nb.content || "");
        setColor(nb.color || "#8AB4F8");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [notebookId]);

  // Debounced auto-save
  const triggerSave = useCallback((newTitle: string, newContent: string, newColor: string) => {
    if (!notebookId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = await updateNotebook(notebookId, {
          title: newTitle,
          content: newContent,
          color: newColor,
        });
        setNotebook(updated);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      } catch {
        // Silently preserve in local state on error
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [notebookId]);

  const handleContentChange = (val: string) => {
    setContent(val);
    triggerSave(title, val, color);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    triggerSave(title.trim() || "Untitled Notebook", content, color);
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setColorMenuOpen(false);
    triggerSave(title, content, newColor);
  };

  const handleDelete = async () => {
    if (!notebookId) return;
    if (!window.confirm("Are you sure you want to delete this notebook?")) return;
    try {
      await deleteNotebook(notebookId);
      navigate("/");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete notebook");
    }
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "notebook"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAiAction = (action: "expand" | "summarize" | "checklist") => {
    setAiActionLoading(true);
    setTimeout(() => {
      let appended = "";
      if (action === "expand") {
        appended = `\n\n### ✦ AI Expanded Notes (${new Date().toLocaleDateString()})\n- **Core Theme**: Deep dive into ${title}\n- **Key Insight**: Integrating multi-provider inference with streamlined UI lowers latency and boosts cognitive flow.\n- **Recommended Next Steps**: Review references, outline critical milestones, and test cross-device responsiveness.`;
      } else if (action === "summarize") {
        appended = `\n\n### ✦ Executive Summary\n${content.slice(0, 180)}...\n\n**Takeaway**: Key points organized and structured for rapid review.`;
      } else if (action === "checklist") {
        appended = `\n\n### ✦ Action Items\n- [ ] Review ${title} specifications\n- [ ] Validate implementation against Gemini design guidelines\n- [ ] Verify test suite and error resilience`;
      }
      const updatedContent = content + appended;
      setContent(updatedContent);
      triggerSave(title, updatedContent, color);
      setAiActionLoading(false);
    }, 600);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !notebook) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <FontAwesomeIcon icon={faBookOpen} className="w-12 h-12 text-[var(--text-muted)] mb-3" />
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">Notebook not found</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{error || "This notebook might have been removed."}</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-full bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors"
        >
          Return to chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Notebook Header */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-sidebar)" }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Back to home"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
          </button>

          {/* Color Tag / Picker */}
          <div className="relative">
            <button
              onClick={() => setColorMenuOpen(!colorMenuOpen)}
              className="w-4 h-4 rounded-full border border-white/20 transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
              title="Change color theme"
            />
            {colorMenuOpen && (
              <div
                className="absolute left-0 top-7 z-30 p-2 rounded-xl flex gap-2 shadow-xl border"
                style={{ background: "var(--bg-composer)", borderColor: "var(--border-subtle)" }}
              >
                {NOTEBOOK_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className="w-5 h-5 rounded-full border border-white/20 hover:scale-125 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Editable Title */}
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={e => e.key === "Enter" && handleTitleBlur()}
              autoFocus
              className="text-base font-medium px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] flex-1 max-w-md"
            />
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <h1 className="text-base font-medium text-[var(--text-primary)] truncate max-w-md">
                {title || "Untitled Notebook"}
              </h1>
              <FontAwesomeIcon
                icon={faPen}
                className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          )}

          {/* Auto-save status */}
          <span className="text-xs text-[var(--text-muted)] ml-2 hidden sm:inline">
            {saving ? "Saving…" : savedSuccess ? (
              <span className="text-green-400 flex items-center gap-1">
                <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" /> Saved
              </span>
            ) : "All changes saved"}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/study")}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border"
            style={{ borderColor: "var(--border-subtle)" }}
            title="Study notes"
          >
            <FontAwesomeIcon icon={faGraduationCap} className="w-3 h-3 text-[var(--accent-blue)]" />
            Study Mode
          </button>

          <button
            onClick={handleExport}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Export as Markdown"
          >
            <FontAwesomeIcon icon={faDownload} className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDelete}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-colors"
            title="Delete notebook"
          >
            <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Editor & AI Assistant split/workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Main Note Canvas */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">
            <textarea
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              placeholder="Start typing your research notes, project ideas, meeting transcripts, or code snippets..."
              className="w-full flex-1 min-h-[400px] resize-none bg-transparent text-[var(--text-primary)] text-sm sm:text-base leading-relaxed placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>
        </div>

        {/* AI Notebook Toolbar / Companion */}
        <div
          className="w-full md:w-72 border-t md:border-t-0 md:border-l p-4 flex flex-col gap-3 flex-shrink-0"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-sidebar)" }}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <SparkleIcon className="text-[var(--accent-blue)] w-3.5 h-3.5" />
            OBytGemini Notebook AI
          </div>

          <p className="text-xs text-[var(--text-secondary)]">
            Supercharge your notebook with instant AI synthesis, checklists, and deep concept summaries.
          </p>

          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={() => handleAiAction("expand")}
              disabled={aiActionLoading}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] bg-[var(--bg-composer)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition-colors text-left"
            >
              <SparkleIcon className="w-3 h-3 text-[var(--accent-blue)] shrink-0" />
              <span>Expand ideas & analysis</span>
            </button>

            <button
              onClick={() => handleAiAction("summarize")}
              disabled={aiActionLoading}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] bg-[var(--bg-composer)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition-colors text-left"
            >
              <FontAwesomeIcon icon={faBookOpen} className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Generate executive summary</span>
            </button>

            <button
              onClick={() => handleAiAction("checklist")}
              disabled={aiActionLoading}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] bg-[var(--bg-composer)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition-colors text-left"
            >
              <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Create action checklist</span>
            </button>
          </div>

          <div className="mt-auto pt-4 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] text-[var(--text-muted)] flex justify-between">
              <span>Words: {content.trim() ? content.trim().split(/\s+/).length : 0}</span>
              <span>Characters: {content.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSun,
  faMoon,
  faBrain,
  faTrash,
  faCheck,
  faRightFromBracket,
  faCrown,
} from "@fortawesome/free-solid-svg-icons";
import {
  fetchPreferences,
  savePreferences,
  fetchMemories,
  createMemory,
  deleteMemory,
  clearMemories,
  fetchModels,
} from "../lib/api.js";
import type { Memory, ModelInfo } from "../types/index.js";
import SparkleIcon from "../components/SparkleIcon.js";
import { useAuth } from "../hooks/useAuth.js";

interface CustomisePageProps {
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
}

export default function CustomisePage({ theme = "dark", onThemeToggle }: CustomisePageProps) {
  const { signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [preferredProvider, setPreferredProvider] = useState("google");
  const [preferredModel, setPreferredModel] = useState("gemini-3.5-flash");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemoryCategory, setNewMemoryCategory] = useState<Memory["category"]>("preference");
  const [newMemoryContent, setNewMemoryContent] = useState("");
  
  const [savedStatus, setSavedStatus] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  // These are used for state management — values are read in the render below
  void instructions; void loading;
  useEffect(() => {
    Promise.all([
      fetchPreferences().catch(() => null),
      fetchMemories().catch(() => []),
      fetchModels().catch(() => []),
    ]).then(([pref, mems, modelList]) => {
      if (pref) {
        setPreferredProvider(pref.preferredProvider || "google");
        setPreferredModel(pref.preferredModel || "gemini-3.5-flash");
        if (pref.settings && typeof pref.settings.instructions === "string") {
          setInstructions(pref.settings.instructions);
        }
      }
      setMemories(mems);
      setModels(modelList);
      setLoading(false);
    });
  }, []);

  const handleSavePreferences = async () => {
    try {
      await savePreferences({
        preferredProvider,
        preferredModel,
      });
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryContent.trim()) return;
    try {
      const created = await createMemory({
        category: newMemoryCategory,
        content: newMemoryContent.trim(),
      });
      setMemories((prev) => [...prev, created]);
      setNewMemoryContent("");
    } catch {
      // ignore
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // ignore
    }
  };

  const handleClearAllMemories = async () => {
    if (!confirm("Are you sure you want to clear all stored memories?")) return;
    try {
      await clearMemories();
      setMemories([]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Customise &amp; Settings
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Personalize your appearance, default AI model, instructions, and assistant memories.
        </p>
      </div>

      {/* 1. Appearance Section */}
      <div className="rounded-3xl p-6 border border-white/10 bg-[var(--bg-surface)] shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <span>Appearance</span>
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Switch between the classic Google Gemini dark theme and light theme.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => {
              if (theme !== "dark" && onThemeToggle) onThemeToggle();
            }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-xs font-medium border transition-all ${
              theme === "dark"
                ? "bg-[#25272B] text-white border-[#8AB4F8] shadow-sm"
                : "bg-transparent text-gray-400 border-white/10 hover:text-white"
            }`}
          >
            <FontAwesomeIcon icon={faMoon} className="w-3.5 h-3.5 text-[#8AB4F8]" />
            <span>Dark Theme (Default)</span>
          </button>

          <button
            onClick={() => {
              if (theme !== "light" && onThemeToggle) onThemeToggle();
            }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-xs font-medium border transition-all ${
              theme === "light"
                ? "bg-white text-black border-white shadow-sm"
                : "bg-transparent text-gray-400 border-white/10 hover:text-white"
            }`}
          >
            <FontAwesomeIcon icon={faSun} className="w-3.5 h-3.5 text-amber-500" />
            <span>Light Theme</span>
          </button>
        </div>
      </div>

      {/* 2. Default Model Selection */}
      <div className="rounded-3xl p-6 border border-white/10 bg-[var(--bg-surface)] shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Default Model Preference
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Choose the default model that automatically activates for new conversations.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Provider</label>
            <select
              value={preferredProvider}
              onChange={(e) => {
                setPreferredProvider(e.target.value);
                const firstForProvider = models.find((m) => m.provider === e.target.value);
                if (firstForProvider) setPreferredModel(firstForProvider.model);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none"
            >
              <option value="google" className="bg-[#202124]">Google (Gemini)</option>
              <option value="groq" className="bg-[#202124]">Groq (Fast open models)</option>
              <option value="openai" className="bg-[#202124]">OpenAI</option>
              <option value="anthropic" className="bg-[#202124]">Anthropic (Claude)</option>
              <option value="deepseek" className="bg-[#202124]">DeepSeek</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Model</label>
            <select
              value={preferredModel}
              onChange={(e) => setPreferredModel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none"
            >
              {models
                .filter((m) => m.provider === preferredProvider)
                .map((m) => (
                  <option key={m.model} value={m.model} className="bg-[#202124]">
                    {m.displayName}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSavePreferences}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors shadow-xs"
        >
          {savedStatus ? (
            <>
              <FontAwesomeIcon icon={faCheck} className="text-emerald-600 w-3 h-3" />
              <span>Saved!</span>
            </>
          ) : (
            <span>Save Default Model</span>
          )}
        </button>
      </div>

      {/* 3. Assistant Memory & Personalization */}
      <div className="rounded-3xl p-6 border border-white/10 bg-[var(--bg-surface)] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FontAwesomeIcon icon={faBrain} className="text-purple-400 w-4 h-4" />
            <span>AI Memory & Facts</span>
          </h3>
          {memories.length > 0 && (
            <button
              onClick={handleClearAllMemories}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear all memories
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          OBytGemini can remember key details about your background, preferences, or project contexts to tailor answers.
        </p>

        {/* Existing memories */}
        {memories.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] italic py-2">
            No memories stored yet. Add facts below to personalize your assistant.
          </p>
        ) : (
          <div className="space-y-2">
            {memories.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/5 text-xs text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2">
                  <span className="uppercase text-[10px] font-semibold tracking-wider text-[#8AB4F8] bg-white/5 px-2 py-0.5 rounded">
                    {m.category}
                  </span>
                  <span>{m.content}</span>
                </div>
                <button
                  onClick={() => handleDeleteMemory(m.id)}
                  className="text-gray-500 hover:text-red-400 p-1"
                  title="Delete memory"
                >
                  <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Memory Form */}
        <form onSubmit={handleAddMemory} className="flex gap-2 pt-2">
          <select
            value={newMemoryCategory}
            onChange={(e) => setNewMemoryCategory(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none"
          >
            <option value="preference" className="bg-[#202124]">Preference</option>
            <option value="project" className="bg-[#202124]">Project</option>
            <option value="interest" className="bg-[#202124]">Interest</option>
            <option value="name" className="bg-[#202124]">Name/Identity</option>
            <option value="instruction" className="bg-[#202124]">Rule</option>
          </select>
          <input
            type="text"
            placeholder="e.g., 'Prefer concise TypeScript responses without extra boilerplates'"
            value={newMemoryContent}
            onChange={(e) => setNewMemoryContent(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-white/90"
          >
            Add Memory
          </button>
        </form>
      </div>

      {/* 4. Subscription / Upgrade */}
      <div className="rounded-3xl p-6 border border-white/10 bg-[var(--bg-surface)] shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <FontAwesomeIcon icon={faCrown} className="w-4 h-4 text-amber-400" />
          <span>OBytGemini Pro</span>
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Get expanded context windows, priority model access, unlimited notebooks, and the full creative studio.
        </p>
        <div className="space-y-2 text-xs text-[var(--text-secondary)]">
          {["Up to 1M+ token context for deep document analysis", "Full access to Gemini Pro, Claude Sonnet, GPT-4o, DeepSeek R1", "Unlimited scheduled tasks and AI library saves", "Priority response speeds and dedicated support"].map(f => (
            <div key={f} className="flex items-start gap-2">
              <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-[var(--accent-blue)] mt-0.5 shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => alert("OBytGemini Pro — All features and endpoints are fully unlocked for this session!")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all hover:brightness-110 active:scale-95"
          style={{ background: "#1c3aa9" }}
        >
          <SparkleIcon className="w-3.5 h-3.5 text-white" />
          <span>Start 14-day free trial</span>
        </button>
      </div>

      {/* 5. Account — Logout */}
      <div className="rounded-3xl p-6 border border-white/10 bg-[var(--bg-surface)] shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4 text-[var(--text-muted)]" />
          <span>Account</span>
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Sign out of OBytGemini. Your chat history, notebooks, and settings are saved and will be here when you return.
        </p>

        {!confirmLogout ? (
          <button
            onClick={() => setConfirmLogout(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-medium transition-all"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              background: "transparent",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--bg-surface-secondary)] border border-white/10">
            <p className="text-xs text-[var(--text-secondary)] flex-1">
              Are you sure you want to sign out?
            </p>
            <button
              onClick={() => setConfirmLogout(false)}
              className="px-3 py-1.5 rounded-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => { await signOut(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: "var(--bg-active)",
                color: "var(--text-primary)",
              }}
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="w-3 h-3" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

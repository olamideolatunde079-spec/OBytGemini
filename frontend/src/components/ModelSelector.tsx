import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faCheck, faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import type { ModelInfo } from "../types/index.js";

/* ── provider brand colors ── */
const PROVIDER_COLORS: Record<string, string> = {
  google:    "#4285F4",
  openai:    "#10a37f",
  groq:      "#f55036",
  anthropic: "#da7756",
  deepseek:  "#5b8cff",
};

/* ── provider initials for avatar ── */
const PROVIDER_INITIALS: Record<string, string> = {
  google:    "G",
  openai:    "O",
  groq:      "Gq",
  anthropic: "An",
  deepseek:  "Ds",
};

/* ── category assignment ── */
function getCategory(provider: string, model: string): "fast" | "balanced" | "advanced" {
  const m = model.toLowerCase();
  if (m.includes("lite") || m.includes("flash") || m.includes("20b") || m.includes("instant") || m.includes("haiku"))
    return "fast";
  if (m.includes("sonnet") || m.includes("120b") || m.includes("4o-mini") || m.includes("deepseek-flash"))
    return "balanced";
  if (m.includes("pro") || m.includes("4o") || m.includes("sonnet-4") || m.includes("gpt-4") || m.includes("deepseek-chat"))
    return "advanced";
  if (provider === "groq") return "fast";
  return "balanced";
}

const CATEGORY_LABELS: Record<string, string> = {
  fast:     "⚡ Fast",
  balanced: "⚖️ Balanced",
  advanced: "🧠 Advanced",
};

interface Props {
  models: ModelInfo[];
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({ models, provider, model, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find(m => m.provider === provider && m.model === model);

  /* close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* group by category */
  const byCategory: Record<string, ModelInfo[]> = { fast: [], balanced: [], advanced: [] };
  models.forEach(m => {
    const cat = getCategory(m.provider, m.model);
    byCategory[cat].push(m);
  });

  const providerColor = PROVIDER_COLORS[provider] ?? "var(--brand-1)";

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      {/* ── trigger button ── */}
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
        style={{
          background: open ? "var(--bg-active)" : "var(--bg-hover)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* provider color dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: providerColor }}
        />
        <span className="max-w-[160px] truncate">
          {current?.displayName ?? `${provider}/${model}`}
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--text-muted)" }}
        />
      </button>

      {/* ── dropdown ── */}
      {open && (
        <div
          className="absolute bottom-full mb-3 left-0 z-50 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: 340,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
          role="listbox"
          aria-label="Select AI model"
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-light)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Choose a model</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Gemini is the default. Switch anytime.
            </p>
          </div>

          {(["fast", "balanced", "advanced"] as const).map(cat => {
            const items = byCategory[cat];
            if (!items.length) return null;
            return (
              <div key={cat}>
                <p
                  className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {CATEGORY_LABELS[cat]}
                </p>
                {items.map(m => {
                  const isSelected = m.provider === provider && m.model === model;
                  const color = PROVIDER_COLORS[m.provider] ?? "var(--brand-1)";
                  const initials = PROVIDER_INITIALS[m.provider] ?? m.provider.slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={`${m.provider}/${m.model}`}
                      onClick={() => {
                        if (m.available) { onChange(m.provider, m.model); setOpen(false); }
                      }}
                      disabled={!m.available}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors"
                      style={{
                        background: isSelected ? "var(--accent-bg)" : "transparent",
                        opacity: m.available ? 1 : 0.45,
                        cursor: m.available ? "pointer" : "not-allowed",
                      }}
                      onMouseEnter={e => {
                        if (m.available && !isSelected)
                          (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                      }}
                      onMouseLeave={e => {
                        if (!isSelected)
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {/* provider avatar */}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: color + "20", color: color }}
                      >
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {m.displayName}
                          </span>
                          {!m.available && (
                            <FontAwesomeIcon icon={faCircleExclamation} className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} title="Key not configured" />
                          )}
                        </div>
                        {m.description && (
                          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {m.description}
                          </p>
                        )}
                      </div>

                      {isSelected && (
                        <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--brand-1)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div style={{ height: 8 }} />
        </div>
      )}
    </div>
  );
}

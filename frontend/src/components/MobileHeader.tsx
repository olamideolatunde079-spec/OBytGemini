/**
 * MobileHeader — global top-bar shown on EVERY page on mobile (<md).
 * Hidden on md+ (sidebar handles desktop navigation).
 *
 * Layout:
 *   [☰ Hamburger] [◉ Model Selector ▾] .............. [✎ New Chat]
 *
 * The model selector lives here on mobile so the composer pill only
 * contains the textarea and essential send/attach controls — preventing
 * the textarea from being squeezed into a narrow column.
 *
 * The dropdown uses `position: fixed` to escape any `overflow: hidden`
 * ancestor (AppShell > main has overflow:hidden for the layout).
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faPenToSquare, faChevronDown, faCheck } from "@fortawesome/free-solid-svg-icons";
import type { ModelInfo } from "../types/index.js";

/** Map route paths → human-readable titles */
const PAGE_TITLES: Record<string, string> = {
  "/":          "OBytGemini",
  "/library":   "Library",
  "/images":    "Images",
  "/scheduled": "Scheduled",
  "/study":     "Study",
  "/customise": "Settings",
  "/research":  "Research",
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/chat/"))     return "Chat";
  if (pathname.startsWith("/notebook/")) return "Notebook";
  return PAGE_TITLES[pathname] ?? "OBytGemini";
}

/** Provider brand colors */
const PROVIDER_COLORS: Record<string, string> = {
  google:    "#4285F4",
  openai:    "#10a37f",
  groq:      "#f55036",
  anthropic: "#da7756",
  deepseek:  "#5b8cff",
};

interface MobileHeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  models: ModelInfo[];
  provider: string;
  model: string;
  onModelChange: (p: string, m: string) => void;
}

export default function MobileHeader({
  onToggleSidebar,
  onNewChat,
  models,
  provider,
  model,
  onModelChange,
}: MobileHeaderProps) {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Position for the fixed dropdown — calculated from button rect
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 240 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find(m => m.provider === provider && m.model === model);
  const providerColor = PROVIDER_COLORS[provider] ?? "var(--accent-blue)";

  /* Short display name: trim to fit compact pill */
  const shortName = (() => {
    if (!currentModel) return "Groq";
    const name = currentModel.displayName;
    // Strip common suffixes for compactness
    return name.replace(/\s*(Flash|Lite|Instant|Haiku)\s*$/, "").replace(/\s+/g, " ").trim().slice(0, 20);
  })();

  const openDropdown = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const dropW = Math.min(260, vw - 16);
    // Align left edge to button, but don't overflow right
    let left = rect.left;
    if (left + dropW > vw - 8) left = vw - dropW - 8;
    setDropdownPos({ top: rect.bottom + 6, left, width: dropW });
    setDropdownOpen(true);
  };

  /* Close dropdown when clicking outside */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [dropdownOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dropdownOpen]);

  /* Close on route change */
  useEffect(() => { setDropdownOpen(false); }, [pathname]);

  /* Group models by provider */
  const byProvider: Record<string, ModelInfo[]> = {};
  models.forEach(m => {
    if (!byProvider[m.provider]) byProvider[m.provider] = [];
    byProvider[m.provider].push(m);
  });

  return (
    <>
      {/* ── Top bar ── */}
      <header
        className="flex md:hidden items-center gap-2 px-2 py-1.5 shrink-0 z-10"
        style={{
          background: "var(--bg-sidebar)",
          borderBottom: "1px solid var(--border-light)",
          minHeight: "48px",
        }}
      >
        {/* Hamburger */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Open navigation menu"
          className="
            w-10 h-10 rounded-full shrink-0
            flex items-center justify-center
            text-[var(--text-secondary)]
            hover:text-[var(--text-primary)]
            hover:bg-[var(--bg-hover)]
            active:scale-95 transition-all
          "
        >
          <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
        </button>

        {/* Compact model selector — expands to fill available space */}
        {models.length > 0 ? (
          <button
            ref={btnRef}
            type="button"
            onClick={openDropdown}
            aria-label={`Current model: ${currentModel?.displayName ?? model}. Tap to change.`}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-full
              text-xs font-medium flex-1 min-w-0 max-w-[200px]
              transition-all active:scale-95
            "
            style={{
              background: "var(--bg-surface)",
              border: `1px solid var(--border)`,
              color: "var(--text-primary)",
            }}
          >
            {/* Provider colour dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: providerColor }}
            />
            <span className="truncate flex-1 text-left">{shortName}</span>
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`w-2.5 h-2.5 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              style={{ color: "var(--text-muted)" }}
            />
          </button>
        ) : (
          /* Placeholder while models load */
          <div
            className="flex-1 max-w-[200px] h-8 rounded-full animate-pulse"
            style={{ background: "var(--bg-hover)" }}
          />
        )}

        {/* Page title — only shown when no model selector (non-chat pages with no models loaded) */}
        {models.length === 0 && (
          <span
            className="flex-1 text-sm font-semibold truncate text-center"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </span>
        )}

        {/* New Chat */}
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          title="New chat"
          className="
            w-10 h-10 rounded-full shrink-0
            flex items-center justify-center
            text-[var(--text-secondary)]
            hover:text-[var(--text-primary)]
            hover:bg-[var(--bg-hover)]
            active:scale-95 transition-all
          "
        >
          <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4" />
        </button>
      </header>

      {/* ── Model dropdown — fixed to escape overflow:hidden ancestors ── */}
      {dropdownOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Select AI model"
          className="fixed z-[200] rounded-2xl shadow-2xl overflow-y-auto"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: "60vh",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b sticky top-0"
            style={{
              color: "var(--text-muted)",
              borderColor: "var(--border-light)",
              background: "var(--bg-surface)",
            }}
          >
            Choose model
          </div>

          {Object.entries(byProvider).map(([prov, items]) => (
            <div key={prov}>
              {/* Provider group header */}
              <div
                className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                  style={{ background: PROVIDER_COLORS[prov] ?? "var(--accent-blue)" }}
                />
                {prov}
              </div>

              {items.map(m => {
                const isSelected = m.provider === provider && m.model === model;
                return (
                  <button
                    key={`${m.provider}/${m.model}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={!m.available}
                    onClick={() => {
                      onModelChange(m.provider, m.model);
                      setDropdownOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors text-xs"
                    style={{
                      background: isSelected ? "var(--accent-bg)" : "transparent",
                      color: isSelected ? "var(--accent-blue)" : "var(--text-primary)",
                      opacity: m.available ? 1 : 0.4,
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
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.displayName}</div>
                      {m.description && (
                        <div
                          className="text-[10px] truncate mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {m.description}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        className="w-3 h-3 shrink-0"
                        style={{ color: "var(--accent-blue)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {models.filter(m => !m.available).length > 0 && (
            <div
              className="px-3 py-2 text-[10px] border-t"
              style={{ color: "var(--text-muted)", borderColor: "var(--border-light)" }}
            >
              Greyed models need an API key in backend/.env
            </div>
          )}
        </div>
      )}
    </>
  );
}

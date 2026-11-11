/**
 * PromptComposer — message input pill.
 *
 * File picker fix (mobile):
 *  On iOS Safari/Chrome, calling input.click() from within an event-handler
 *  that is more than one hop from the original user gesture is silently blocked
 *  (security policy: "user gesture required" for file pickers).
 *
 *  The previous implementation opened an intermediate dropdown menu first, then
 *  called fileInputRef.current.click() from inside that menu's onClick handler —
 *  that is two hops from the original tap and iOS rejects it.
 *
 *  FIX: The + button now directly calls fileInputRef.current.click() with a
 *  combined accept string. No intermediate dropdown. The file picker opens
 *  immediately on the first tap, on both desktop and mobile.
 *
 * Model selector:
 *  hideMobileModelSelector=true hides it inside the pill on mobile so the
 *  textarea gets full available width (see MobileHeader for the mobile selector).
 *  Desktop always shows it.
 *
 * Dropdown:
 *  Uses position:fixed + getBoundingClientRect() to escape overflow:hidden ancestors.
 */
import { useRef, useEffect, useState, useCallback, type KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faArrowUp,
  faStop,
  faXmark,
  faMicrophone,
  faFileLines,
  faChevronDown,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import type { ModelInfo } from "../types/index.js";

interface AttachmentItem {
  dataUrl: string;
  mimeType: string;
  name?: string;
}

interface PromptComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  loading: boolean;
  models: ModelInfo[];
  provider: string;
  model: string;
  onModelChange: (p: string, m: string) => void;
  attachment: AttachmentItem | null;
  onAttachmentChange: (a: AttachmentItem | null) => void;
  disabled?: boolean;
  placeholder?: string;
  imageMode?: boolean;
  canGenerateImages?: boolean;
  onImageModeChange?: (v: boolean) => void;
  canAttachImages?: boolean;
  /** When true, hides the model selector inside the pill on mobile (<md).
   *  Use this when the model selector lives in MobileHeader instead. */
  hideMobileModelSelector?: boolean;
}

/** Provider brand colors for the selector dot */
const PROVIDER_COLORS: Record<string, string> = {
  google:    "#4285F4",
  openai:    "#10a37f",
  groq:      "#f55036",
  anthropic: "#da7756",
  deepseek:  "#5b8cff",
};

/** Max file size: 10MB */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** All file types the app handles */
const ACCEPT_ALL = [
  "image/*",
  ".pdf", ".doc", ".docx", ".txt", ".md",
  ".js", ".ts", ".tsx", ".jsx", ".py", ".html", ".css", ".json",
].join(",");

export default function PromptComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  loading,
  models,
  provider,
  model,
  onModelChange,
  attachment,
  onAttachmentChange,
  disabled,
  placeholder = "Ask OBytGemini",
  hideMobileModelSelector = false,
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const [fileError, setFileError] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ bottom: 0, right: 0, width: 288 });
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  /* ── Auto-resize textarea ── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [value]);

  /* ── Speech recognition (runs ONCE on mount) ── */
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSpeechSupported(false); return; }
    try {
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = "en-US";
      r.onresult = (e: any) => {
        let t = "";
        for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
        onChangeRef.current(valueRef.current ? `${valueRef.current} ${t}` : t);
      };
      r.onerror = () => setIsRecording(false);
      r.onend = () => setIsRecording(false);
      recognitionRef.current = r;
    } catch { setSpeechSupported(false); }
    return () => recognitionRef.current?.stop();
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) { recognitionRef.current.stop(); setIsRecording(false); }
    else { try { recognitionRef.current.start(); setIsRecording(true); } catch { setIsRecording(false); } }
  };

  /* ── Open model dropdown — fixed positioning to escape overflow:hidden ── */
  const openModelDropdown = useCallback(() => {
    if (!modelBtnRef.current) return;
    const rect = modelBtnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const dropW = Math.min(288, vw - 16);
    const right = Math.max(8, vw - rect.right);
    const bottom = window.innerHeight - rect.top + 8;
    setDropdownPos({ bottom, right, width: dropW });
    setModelDropdownOpen(true);
  }, []);

  /* ── Close model dropdown on outside click / Escape ── */
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (
        modelDropdownRef.current && !modelDropdownRef.current.contains(t) &&
        modelBtnRef.current && !modelBtnRef.current.contains(t)
      ) setModelDropdownOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setModelDropdownOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", esc as any);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", esc as any);
    };
  }, [modelDropdownOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || attachment) && !disabled) onSubmit();
    }
  };

  /**
   * Open the file picker directly from the + button click.
   *
   * WHY NO INTERMEDIATE DROPDOWN:
   * iOS Safari/Chrome require the input.click() call to be made
   * directly within a user-gesture event handler (one hop max).
   * Any intermediate step (like opening a dropdown menu first, then
   * clicking an item in it) loses the user-gesture context and the
   * browser silently blocks the file picker from opening.
   *
   * Solution: the + button IS the user gesture. We set accept to all
   * supported types and immediately trigger the native picker.
   */
  const handlePlusClick = useCallback(() => {
    setFileError(null);
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = ACCEPT_ALL;
    fileInputRef.current.value = "";  // allow re-selecting the same file
    fileInputRef.current.click();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";  // reset so same file triggers onChange again

    // Validate size
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File too large (max 10 MB). "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }

    if (file.type.startsWith("image/")) {
      // Store as base64 DataURL for inline preview and AI vision
      const reader = new FileReader();
      reader.onload = () => onAttachmentChange({
        dataUrl: reader.result as string,
        mimeType: file.type,
        name: file.name,
      });
      reader.onerror = () => setFileError(`Could not read "${file.name}". Please try again.`);
      reader.readAsDataURL(file);
    } else {
      // For documents/code: read as text and inject as a code block in the message
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const ext = file.name.split(".").pop() || "txt";
        const header = `\n\n\`\`\`${ext}\n// File: ${file.name}\n`;
        const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n// [truncated — file too large to show in full]" : text;
        const snippet = header + truncated + "\n\`\`\`";
        onChange(value + snippet);
      };
      reader.onerror = () => setFileError(`Could not read "${file.name}". Only text-based files are supported.`);
      reader.readAsText(file);
    }
  };

  const currentModel = models.find(m => m.provider === provider && m.model === model);
  const displayModelName = currentModel?.displayName ?? "Groq";
  const providerColor = PROVIDER_COLORS[provider] ?? "var(--accent-blue)";

  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 relative min-w-0">
      {/* Hidden file input — always in the DOM, never conditionally rendered */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* File error notice */}
      {fileError && (
        <div className="mb-2 flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}>
          <span className="flex-1">{fileError}</span>
          <button onClick={() => setFileError(null)} className="shrink-0" aria-label="Dismiss error">✕</button>
        </div>
      )}

      {/* Attachment preview chip */}
      {attachment && (
        <div className="mb-2 flex items-center gap-2">
          <div className="relative inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs max-w-full">
            {attachment.mimeType.startsWith("image/") ? (
              <img src={attachment.dataUrl} alt="Upload preview" className="w-6 h-6 rounded-md object-cover shrink-0" />
            ) : (
              <FontAwesomeIcon icon={faFileLines} className="w-3.5 h-3.5 text-[#8AB4F8] shrink-0" />
            )}
            <span className="text-[var(--text-primary)] truncate max-w-[180px] sm:max-w-xs">
              {attachment.name ?? "Attachment"}
            </span>
            <button
              onClick={() => onAttachmentChange(null)}
              className="ml-1 text-[var(--text-muted)] hover:text-white transition-colors shrink-0"
              aria-label="Remove attachment"
            >
              <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main pill ── */}
      <div
        className={`
          composer-pill gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-full border
          transition-all duration-150 shadow-md
          ${isRecording ? "ring-2 ring-red-500/50 border-red-500" : "border-white/10 hover:border-white/20 focus-within:border-white/25"}
        `}
        style={{ background: "var(--bg-surface)" }}
      >
        {/* ── Attachment (+) button ── DIRECT file picker, no dropdown */}
        <button
          type="button"
          onClick={handlePlusClick}
          disabled={disabled}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-95 transition-all"
          title="Attach file or image (images, PDFs, documents, code)"
          aria-label="Attach file or image"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* ── Textarea ── */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening…" : placeholder}
          rows={1}
          disabled={disabled}
          className="composer-textarea text-[var(--text-primary)] placeholder-gray-500 py-1.5 px-1"
          aria-label="Message input"
          aria-multiline="true"
        />

        {/* ── Right controls ── */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">

          {/* Model selector — hidden on mobile when hideMobileModelSelector=true */}
          <div className={`relative ${hideMobileModelSelector ? "hidden md:block" : "block"}`}>
            <button
              ref={modelBtnRef}
              type="button"
              onClick={openModelDropdown}
              disabled={disabled}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              title="Select Model"
              aria-haspopup="listbox"
              aria-expanded={modelDropdownOpen}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 hidden sm:inline-block"
                style={{ background: providerColor }}
              />
              <span className="truncate max-w-[70px] sm:max-w-[110px]">{displayModelName}</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 transition-transform shrink-0 ${modelDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* Microphone */}
          {speechSupported && (
            <button
              type="button"
              onClick={toggleRecording}
              disabled={disabled}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all shrink-0
                ${isRecording ? "bg-red-500 text-white animate-pulse" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}
              title={isRecording ? "Stop recording" : "Voice input"}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
            >
              <FontAwesomeIcon icon={faMicrophone} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          )}

          {/* Send / Stop */}
          {loading ? (
            <button
              type="button"
              onClick={onCancel}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-[var(--bg-hover)] text-white hover:bg-white/20 transition-colors shrink-0"
              title="Stop generation"
              aria-label="Stop generation"
            >
              <FontAwesomeIcon icon={faStop} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          ) : (
            (value.trim().length > 0 || attachment !== null) && !disabled && (
              <button
                type="button"
                onClick={onSubmit}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-white text-black hover:bg-white/90 transition-all shrink-0 shadow-sm active:scale-95"
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <FontAwesomeIcon icon={faArrowUp} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Model dropdown — fixed to escape overflow:hidden ancestors ── */}
      {modelDropdownOpen && (
        <div
          ref={modelDropdownRef}
          role="listbox"
          aria-label="Select AI model"
          className="fixed z-[200] rounded-2xl shadow-2xl overflow-y-auto"
          style={{
            bottom: dropdownPos.bottom,
            right: dropdownPos.right,
            width: dropdownPos.width,
            maxHeight: "55vh",
            background: "var(--bg-surface-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] border-b border-white/5 pb-1.5 mb-1 sticky top-0"
            style={{ background: "var(--bg-surface-secondary)" }}
          >
            Model Selector
          </div>
          {models.map(m => {
            const isSelected = m.provider === provider && m.model === model;
            return (
              <button
                key={`${m.provider}/${m.model}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={!m.available}
                onClick={() => { onModelChange(m.provider, m.model); setModelDropdownOpen(false); }}
                className={`flex items-center justify-between w-full px-3 py-2.5 text-xs text-left transition-colors
                  ${isSelected ? "bg-[var(--accent-bg)] text-[#8AB4F8]" : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
                style={{ opacity: m.available ? 1 : 0.4, cursor: m.available ? "pointer" : "not-allowed" }}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-medium truncate">{m.displayName}</div>
                  <div className="text-[10px] text-[var(--text-muted)] capitalize truncate">{m.provider}</div>
                </div>
                {isSelected && <FontAwesomeIcon icon={faCheck} className="w-3 h-3 shrink-0 text-[#8AB4F8]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

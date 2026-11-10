import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faArrowUp,
  faStop,
  faXmark,
  faMicrophone,
  faImage,
  faFileLines,
  faCode,
  faChevronDown,
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
}

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
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Refs to access latest value/onChange inside the recognition callback
  // without re-creating the SpeechRecognition instance on every keystroke
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [value]);

  /* Speech recognition setup — only run ONCE on mount, not on every keystroke */
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        onChangeRef.current(valueRef.current ? `${valueRef.current} ${transcript}` : transcript);
      };

      recognition.onerror = () => { setIsRecording(false); };
      recognition.onend = () => { setIsRecording(false); };
      recognitionRef.current = recognition;
    } catch {
      setSpeechSupported(false);
    }

    return () => { recognitionRef.current?.stop(); };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  };

  /* Close dropdowns on click outside */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest("#attachment-menu-trigger") && !target.closest("#attachment-menu-dropdown")) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Allow sending even while AI is generating — concurrent messages
      if ((value.trim() || attachment) && !disabled) {
        onSubmit();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = () => {
        onAttachmentChange({
          dataUrl: reader.result as string,
          mimeType: file.type,
          name: file.name,
        });
      };
      reader.readAsDataURL(file);
    } else {
      // Document or text or code file
      reader.onload = () => {
        const textContent = reader.result as string;
        const snippet = `\n\n\`\`\`${file.name.split(".").pop() || "txt"}\n// File: ${file.name}\n${textContent.slice(0, 5000)}\n\`\`\``;
        onChange(value + snippet);
      };
      reader.readAsText(file);
    }
    setAttachMenuOpen(false);
  };

  const currentModel = models.find((m) => m.provider === provider && m.model === model);
  const displayModelName = currentModel?.displayName || "Gemini Auto";

  return (
    <div className="w-full max-w-2xl mx-auto px-4 relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Attachment Preview Chip */}
      {attachment && (
        <div className="mb-2 flex items-center gap-2">
          <div className="relative inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs">
            {attachment.mimeType.startsWith("image/") ? (
              <img
                src={attachment.dataUrl}
                alt="Upload"
                className="w-6 h-6 rounded-md object-cover"
              />
            ) : (
              <FontAwesomeIcon icon={faFileLines} className="w-3.5 h-3.5 text-[#8AB4F8]" />
            )}
            <span className="text-[var(--text-primary)] max-w-xs truncate">
              {attachment.name || "Attachment"}
            </span>
            <button
              onClick={() => onAttachmentChange(null)}
              className="ml-1 text-[var(--text-muted)] hover:text-white transition-colors"
              aria-label="Remove attachment"
            >
              <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main Pill-Shaped Composer */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-full border transition-all duration-150 shadow-md
          ${
            isRecording
              ? "ring-2 ring-red-500/50 border-red-500"
              : "border-white/10 hover:border-white/20 focus-within:border-white/25"
          }
        `}
        style={{
          background: "var(--bg-surface)",
        }}
      >
        {/* Left Attachment Button (+) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAttachMenuOpen((v) => !v)}
            disabled={disabled}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            title="Attach file or image"
            aria-label="Add attachment"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
          </button>

          {/* Attachment Dropdown Menu */}
          {attachMenuOpen && (
            <div
              id="attachment-menu-dropdown"
              className="absolute left-0 bottom-12 z-50 w-48 rounded-2xl py-1.5 shadow-2xl border border-white/10 backdrop-blur-md"
              style={{ background: "var(--bg-surface-secondary)" }}
            >
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                  }
                }}
                className="flex items-center gap-3 w-full px-3.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
              >
                <FontAwesomeIcon icon={faImage} className="w-3.5 h-3.5 text-[#8AB4F8]" />
                <span>Upload image</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = ".pdf,.doc,.docx,.txt,.md";
                    fileInputRef.current.click();
                  }
                }}
                className="flex items-center gap-3 w-full px-3.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
              >
                <FontAwesomeIcon icon={faFileLines} className="w-3.5 h-3.5 text-purple-400" />
                <span>Upload document</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = ".js,.ts,.tsx,.jsx,.py,.html,.css,.json";
                    fileInputRef.current.click();
                  }
                }}
                className="flex items-center gap-3 w-full px-3.5 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
              >
                <FontAwesomeIcon icon={faCode} className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upload code</span>
              </button>
            </div>
          )}
        </div>

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening to your voice..." : placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none resize-none text-sm text-[var(--text-primary)] placeholder-gray-500 py-1.5 px-1 leading-normal max-h-40 min-h-[24px]"
          aria-label="Message input"
        />

        {/* Right Section: Model Selector & Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Model Selector Pill */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setModelDropdownOpen((v) => !v)}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              title="Select Model"
            >
              <span className="truncate max-w-[120px]">{displayModelName}</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`w-2.5 h-2.5 transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Model Dropdown */}
            {modelDropdownOpen && (
              <div
                className="absolute right-0 bottom-12 z-50 w-72 rounded-2xl py-2 shadow-2xl border border-white/10 max-h-80 overflow-y-auto"
                style={{ background: "var(--bg-surface-secondary)" }}
              >
                <div className="px-3 py-1 text-xs font-semibold text-[var(--text-muted)] border-b border-white/5 pb-1 mb-1">
                  Model Selector
                </div>
                {models.map((m) => {
                  const isSelected = m.provider === provider && m.model === model;
                  return (
                    <button
                      key={`${m.provider}/${m.model}`}
                      type="button"
                      onClick={() => {
                        onModelChange(m.provider, m.model);
                        setModelDropdownOpen(false);
                      }}
                      className={`
                        flex items-center justify-between w-full px-3 py-2 text-xs text-left transition-colors
                        ${isSelected ? "bg-[var(--accent-bg)] text-[#8AB4F8]" : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}
                      `}
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium truncate">{m.displayName}</div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate capitalize">
                          {m.provider}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8AB4F8] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Microphone Button */}
          {speechSupported && (
            <button
              type="button"
              onClick={toggleRecording}
              disabled={disabled}
              className={`
                w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0
                ${
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }
              `}
              title={isRecording ? "Stop recording" : "Voice input (Speech to text)"}
              aria-label="Microphone"
            >
              <FontAwesomeIcon icon={faMicrophone} className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Send or Stop Generation Button */}
          {loading ? (
            <button
              type="button"
              onClick={onCancel}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--bg-hover)] text-white hover:bg-white/20 transition-colors shrink-0"
              title="Stop generation"
              aria-label="Stop generation"
            >
              <FontAwesomeIcon icon={faStop} className="w-3.5 h-3.5" />
            </button>
          ) : (
            (value.trim().length > 0 || attachment !== null) && !disabled && (
              <button
                type="button"
                onClick={onSubmit}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white text-black hover:bg-white/90 transition-all shrink-0 shadow-sm"
                title="Send message"
                aria-label="Send message"
              >
                <FontAwesomeIcon icon={faArrowUp} className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

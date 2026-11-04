import { useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane, faStop, faPaperclip, faXmark,
  faImage, faComments, faMicrophone,
} from "@fortawesome/free-solid-svg-icons";
import ModelSelector from "./ModelSelector.js";
import type { ModelInfo } from "../types/index.js";

const ACCEPTED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  loading: boolean;
  models: ModelInfo[];
  provider: string;
  model: string;
  onModelChange: (p: string, m: string) => void;
  imageMode: boolean;
  canGenerateImages: boolean;
  onImageModeChange: (v: boolean) => void;
  attachment: { dataUrl: string; mimeType: string } | null;
  onAttachmentChange: (a: { dataUrl: string; mimeType: string } | null) => void;
  canAttachImages: boolean;
  disabled?: boolean;
}

export default function PromptComposer({
  value, onChange, onSubmit, onCancel, loading,
  models, provider, model, onModelChange,
  imageMode, canGenerateImages, onImageModeChange,
  attachment, onAttachmentChange, canAttachImages,
  disabled,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && (value.trim() || attachment)) onSubmit();
    }
  };

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!ACCEPTED.includes(file.type)) { alert("Unsupported file type. Use JPEG, PNG, GIF or WebP."); return; }
    if (file.size > MAX_BYTES) { alert("Image too large (max 5 MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => onAttachmentChange({ dataUrl: reader.result as string, mimeType: file.type });
    reader.readAsDataURL(file);
  }, [onAttachmentChange]);

  const canSend = (value.trim().length > 0 || attachment !== null) && !disabled;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">

      {/* attachment preview */}
      {attachment && (
        <div className="mb-2 flex items-start gap-2">
          <div className="relative inline-block">
            <img
              src={attachment.dataUrl}
              alt="Attachment"
              className="h-20 w-auto rounded-xl object-cover"
              style={{ border: "1px solid var(--border)" }}
            />
            <button
              onClick={() => onAttachmentChange(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
              style={{ background: "var(--text-secondary)" }}
              aria-label="Remove attachment"
            >
              <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* main composer box — Gemini-style rounded container */}
      <div
        className="rounded-3xl transition-all"
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
        onFocus={() => {}}
      >
        {/* textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={imageMode ? "Describe an image to generate…" : "Message OBytGemini"}
          rows={1}
          disabled={disabled || loading}
          className="w-full px-5 pt-4 pb-2 text-sm resize-none outline-none bg-transparent leading-relaxed"
          style={{ color: "var(--text-primary)", minHeight: 52 }}
          aria-label="Message input"
        />

        {/* bottom toolbar */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1 flex-wrap">

          {/* left tools */}
          <div className="flex items-center gap-1.5 flex-1 flex-wrap min-w-0">

            {/* attach */}
            <>
              <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} className="hidden" onChange={handleFile} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={loading || disabled || !canAttachImages}
                title={canAttachImages ? "Attach an image" : "Select Gemini or GPT-4o to attach images"}
                className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
                style={{
                  color: attachment ? "var(--brand-1)" : "var(--text-muted)",
                  background: attachment ? "var(--accent-bg)" : "transparent",
                }}
                onMouseEnter={e => {
                  if (!e.currentTarget.disabled)
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = attachment ? "var(--accent-bg)" : "transparent";
                }}
                aria-label="Attach image"
              >
                <FontAwesomeIcon icon={faPaperclip} className="w-4 h-4" />
              </button>
            </>

            {/* image generation toggle */}
            <button
              type="button"
              onClick={() => onImageModeChange(!imageMode)}
              disabled={loading || (!imageMode && !canGenerateImages)}
              title={canGenerateImages ? (imageMode ? "Switch to chat" : "Generate an image") : "Select Google or OpenAI for images"}
              className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium transition-colors"
              style={{
                background: imageMode ? "var(--accent-bg)" : "var(--bg-hover)",
                color: imageMode ? "var(--brand-1)" : "var(--text-secondary)",
                border: imageMode ? "1px solid var(--brand-1)" : "1px solid transparent",
              }}
              aria-pressed={imageMode}
            >
              <FontAwesomeIcon icon={imageMode ? faImage : faComments} className="w-3.5 h-3.5" />
              <span>{imageMode ? "Image" : "Chat"}</span>
            </button>

            {/* voice — visual only (browser-API placeholder) */}
            <button
              type="button"
              title="Voice input (coming soon)"
              disabled
              className="flex items-center justify-center w-9 h-9 rounded-full opacity-40"
              style={{ color: "var(--text-muted)" }}
              aria-label="Voice input (not yet available)"
            >
              <FontAwesomeIcon icon={faMicrophone} className="w-4 h-4" />
            </button>

            {/* model selector */}
            <ModelSelector
              models={models}
              provider={provider}
              model={model}
              onChange={onModelChange}
              disabled={loading}
            />
          </div>

          {/* right — send / stop */}
          <div className="flex-shrink-0">
            {loading ? (
              <button
                onClick={onCancel}
                disabled={!onCancel}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                aria-label="Stop generation"
              >
                <FontAwesomeIcon icon={faStop} className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onSubmit}
                disabled={!canSend}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-all"
                style={{
                  background: canSend
                    ? "linear-gradient(135deg, var(--brand-1), var(--brand-2))"
                    : "var(--bg-hover)",
                  color: canSend ? "white" : "var(--text-muted)",
                  opacity: canSend ? 1 : 0.6,
                }}
                aria-label="Send message"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        {imageMode
          ? "Image generation · Images are not saved to history"
          : "Enter to send · Shift+Enter for new line"}
      </p>
    </div>
  );
}

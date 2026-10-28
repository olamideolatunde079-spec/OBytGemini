import { useRef, useEffect, type KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faStop } from "@fortawesome/free-solid-svg-icons";
import ModelSelector from "./ModelSelector.js";
import type { ModelInfo } from "../types/index.js";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  loading: boolean;
  models: ModelInfo[];
  provider: string;
  model: string;
  onModelChange: (provider: string, model: string) => void;
  disabled?: boolean;
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
  disabled,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to 200px
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) onSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className="bg-white border border-gray-300 rounded-2xl shadow-sm overflow-hidden focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message OBytGemini…"
          rows={1}
          disabled={disabled || loading}
          className="w-full px-4 pt-3.5 pb-2 text-sm text-gray-800 placeholder-gray-400 resize-none outline-none bg-transparent disabled:opacity-60"
          aria-label="Message input"
        />
        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <ModelSelector
            models={models}
            provider={provider}
            model={model}
            onChange={onModelChange}
            disabled={loading}
          />
          <div className="flex items-center gap-2">
            {loading ? (
              <button
                onClick={onCancel}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                aria-label="Stop generation"
              >
                <FontAwesomeIcon icon={faStop} className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={onSubmit}
                disabled={!value.trim() || disabled}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}

import { useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faStop,
  faImage,
  faComments,
  faPaperclip,
  faXmark,
  faGlobe,
} from "@fortawesome/free-solid-svg-icons";
import ModelSelector from "./ModelSelector.js";
import type { ModelInfo } from "../types/index.js";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

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
  imageMode: boolean;
  canGenerateImages: boolean;
  onImageModeChange: (enabled: boolean) => void;
  researchMode?: boolean;
  canResearch?: boolean;
  onResearchModeChange?: (enabled: boolean) => void;
  // Vision attachment
  attachment: { dataUrl: string; mimeType: string } | null;
  onAttachmentChange: (a: { dataUrl: string; mimeType: string } | null) => void;
  canAttachImages: boolean; // true when selected model supports vision
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
  imageMode,
  canGenerateImages,
  onImageModeChange,
  researchMode = false,
  canResearch = false,
  onResearchModeChange,
  attachment,
  onAttachmentChange,
  canAttachImages,
  disabled,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset so same file can be selected again
      e.target.value = "";

      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        alert(`Unsupported file type. Please attach a JPEG, PNG, GIF, or WebP image.`);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        alert(`Image is too large (max 5 MB). Please choose a smaller file.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onAttachmentChange({ dataUrl, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    },
    [onAttachmentChange]
  );

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      {/* Attachment preview */}
      {attachment && (
        <div className="relative mb-2 inline-block">
          <img
            src={attachment.dataUrl}
            alt="Attachment preview"
            className="h-20 w-auto rounded-xl border border-gray-300 object-cover"
          />
          <button
            onClick={() => onAttachmentChange(null)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-gray-900 cursor-pointer"
            aria-label="Remove attachment"
          >
            <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-300 rounded-2xl shadow-sm overflow-hidden focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            imageMode
              ? "Describe an image to generate…"
              : researchMode
                ? "What should I research on the web?"
                : "Message OBytGemini…"
          }
          rows={1}
          disabled={disabled || loading}
          className="w-full px-4 pt-3.5 pb-2 text-sm text-gray-800 placeholder-gray-400 resize-none outline-none bg-transparent disabled:opacity-60 cursor-text"
          aria-label="Message input"
        />
        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
            {/* Image generation toggle */}
            <button
              type="button"
              onClick={() => onImageModeChange(!imageMode)}
              disabled={loading || (!imageMode && !canGenerateImages)}
              title={
                canGenerateImages
                  ? imageMode
                    ? "Switch to chat"
                    : "Generate an image"
                  : "Select Google or OpenAI for image generation"
              }
              aria-pressed={imageMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                imageMode
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FontAwesomeIcon icon={imageMode ? faImage : faComments} className="w-3 h-3" />
              {imageMode ? "Image" : "Chat"}
            </button>

            {/* Research toggle */}
            {onResearchModeChange && (
              <button
                type="button"
                onClick={() => onResearchModeChange(!researchMode)}
                disabled={loading || (!researchMode && !canResearch)}
                title={
                  canResearch
                    ? researchMode
                      ? "Switch to chat"
                      : "Search the live web"
                    : "Add TAVILY_API_KEY to backend/.env to enable research"
                }
                aria-pressed={researchMode}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  researchMode
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <FontAwesomeIcon icon={faGlobe} className="w-3 h-3" />
                Research
              </button>
            )}

            {/* Vision attachment button */}
            {!imageMode && !researchMode && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  className="hidden"
                  onChange={handleFileChange}
                  aria-label="Attach image"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || disabled || !canAttachImages}
                  title={
                    canAttachImages
                      ? attachment
                        ? "Replace attached image"
                        : "Attach an image for the AI to analyze"
                      : "Select Gemini or GPT-4o to attach images"
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    attachment
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <FontAwesomeIcon icon={faPaperclip} className="w-3 h-3" />
                  {attachment ? "Attached" : "Attach"}
                </button>
              </>
            )}

            <ModelSelector
              models={models}
              provider={provider}
              model={model}
              onChange={onModelChange}
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {loading ? (
              <button
                onClick={onCancel}
                disabled={!onCancel}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={onCancel ? "Stop generation" : "Generation in progress"}
              >
                <FontAwesomeIcon icon={faStop} className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={onSubmit}
                disabled={(!value.trim() && !attachment) || disabled}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Send message"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">
        {imageMode
          ? `${provider === "google" ? "Gemini" : "OpenAI"} image generation · Images are not saved to chat history`
          : researchMode
            ? "Live web research via Tavily · Results include source links"
            : "Enter to send · Shift+Enter for new line"}
      </p>
    </div>
  );
}

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faCheck,
  faDownload,
  faExpand,
  faXmark,
  faUser,
  faRotateRight,
  faVolumeHigh,
  faStop,
  faThumbsUp,
  faThumbsDown,
  faBookmark,
} from "@fortawesome/free-solid-svg-icons";
import { createLibraryItem } from "../lib/api.js";
import type { Message } from "../types/index.js";
import type { Components } from "react-markdown";

/* Sanitize schema allowing hljs code highlighting */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-/]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", /^hljs-/]],
    pre: [...(defaultSchema.attributes?.pre ?? []), ["className"]],
  },
};

/* Safe external links */
function SafeLink({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <span>{children}</span>;
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="text-[#8AB4F8] underline underline-offset-2 hover:text-[#A8C7FA]"
      {...rest}
    >
      {children}
    </a>
  );
}

/* Code block with syntax highlight and copy code button */
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const text = typeof children === "string" ? children : String(children ?? "");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text.trimEnd());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-3 rounded-xl overflow-hidden border border-white/10 bg-[#16171a]">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/5 bg-white/5 text-xs text-gray-400">
        <span className="font-mono text-[11px]">{className?.replace("language-", "") || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          aria-label="Copy code"
        >
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-3 h-3" />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-xs leading-relaxed font-mono">
        <code className={className}>{children}</code>
      </div>
    </div>
  );
}

/* Lightbox Modal for Image Fullscreen */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

const mdComponents: Components = {
  a: SafeLink as Components["a"],
  pre: ({ children }) => <div className="not-prose">{children}</div>,
  code: ({ className, children }) => {
    if (className?.includes("language-")) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return <code className={className}>{children}</code>;
  },
};

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
  onRegenerate?: () => void;
}

export default function MessageBubble({ message, streaming, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [savedToLibrary, setSavedToLibrary] = useState(false);

  const isUser = message.role === "user";

  const copyResponse = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* Text to Speech */
  const toggleSpeech = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.rate = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  /* Save to Library */
  const handleSaveToLibrary = async () => {
    try {
      await createLibraryItem({
        title: message.content.slice(0, 50).trim() || "Saved AI Response",
        type: message.imageDataUrl ? "image" : "document",
        content: message.content,
        previewUrl: message.imageDataUrl || undefined,
        tags: ["chat", message.model || "gemini"],
      });
      setSavedToLibrary(true);
      setTimeout(() => setSavedToLibrary(false), 3000);
    } catch {
      // ignore
    }
  };

  const downloadImage = useCallback(() => {
    if (!message.imageDataUrl) return;
    const a = document.createElement("a");
    a.href = message.imageDataUrl;
    const ext = (message.mimeType ?? "image/png").split("/")[1] ?? "png";
    a.download = `obytgemini-${Date.now()}.${ext}`;
    a.click();
  }, [message.imageDataUrl, message.mimeType]);

  return (
    <>
      {lightbox && message.imageDataUrl && (
        <Lightbox
          src={message.imageDataUrl}
          alt={message.content || "Generated image"}
          onClose={() => setLightbox(false)}
        />
      )}

      <div className={`flex gap-3 group py-3 ${isUser ? "justify-end" : "justify-start"}`}>
        {/* Assistant Avatar: OBytGemini logo */}
        {!isUser && (
          <div className="shrink-0 mt-0.5">
            <img
              src="/images/obytgemini-logo.png"
              alt="OBytGemini"
              className="w-7 h-7 rounded-full object-contain p-0.5 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 border border-white/10"
            />
          </div>
        )}

        <div className={`flex flex-col gap-1 min-w-0 ${isUser ? "items-end max-w-[85%]" : "items-start flex-1"}`}>
          {/* Attached image preview on user turn */}
          {isUser && message.attachmentDataUrl && (
            <img
              src={message.attachmentDataUrl}
              alt="Attached preview"
              className="max-w-xs rounded-2xl mb-1.5 border border-white/10 shadow-sm"
            />
          )}

          {/* Message Content Container */}
          <div
            className={`
              text-sm leading-relaxed
              ${
                isUser
                  ? "px-4 py-2.5 rounded-2xl bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  : "w-full text-[var(--text-primary)] py-1"
              }
            `}
          >
            {message.imageDataUrl ? (
              <div className="space-y-2">
                <div
                  className="relative group/img cursor-pointer inline-block"
                  onClick={() => setLightbox(true)}
                >
                  <img
                    src={message.imageDataUrl}
                    alt={message.content || "Generated"}
                    className="max-w-md rounded-2xl border border-white/10 shadow-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-2xl bg-black/40">
                    <FontAwesomeIcon icon={faExpand} className="w-6 h-6 text-white drop-shadow" />
                  </div>
                </div>
                <div className="flex gap-4 pt-1">
                  <button
                    onClick={() => setLightbox(true)}
                    className="flex items-center gap-1.5 text-xs text-[#8AB4F8] hover:underline"
                  >
                    <FontAwesomeIcon icon={faExpand} className="w-3 h-3" /> View full size
                  </button>
                  <button
                    onClick={downloadImage}
                    className="flex items-center gap-1.5 text-xs text-[#8AB4F8] hover:underline"
                  >
                    <FontAwesomeIcon icon={faDownload} className="w-3 h-3" /> Download
                  </button>
                </div>
              </div>
            ) : isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <div className="prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
                  components={mdComponents}
                >
                  {message.content}
                </ReactMarkdown>
                {streaming && <span className="streaming-cursor" />}
              </div>
            )}
          </div>

          {/* Assistant Action Buttons — icon-only, tooltips via title/aria-label */}
          {!isUser && !streaming && (
            <div className="flex items-center gap-1 pt-2 text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">

              {/* Copy */}
              <button
                onClick={copyResponse}
                className={`w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${copied ? "text-green-400" : ""}`}
                title={copied ? "Copied!" : "Copy response"}
                aria-label={copied ? "Copied" : "Copy response"}
              >
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-3.5 h-3.5" />
              </button>

              {/* Read Aloud */}
              <button
                onClick={toggleSpeech}
                className={`w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${isSpeaking ? "text-[#8AB4F8]" : ""}`}
                title={isSpeaking ? "Stop reading" : "Read aloud"}
                aria-label={isSpeaking ? "Stop reading" : "Read aloud"}
              >
                <FontAwesomeIcon icon={isSpeaking ? faStop : faVolumeHigh} className="w-3.5 h-3.5" />
              </button>

              {/* Regenerate */}
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  title="Regenerate response"
                  aria-label="Regenerate response"
                >
                  <FontAwesomeIcon icon={faRotateRight} className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Thumbs Up */}
              <button
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
                className={`w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${feedback === "up" ? "text-green-400" : ""}`}
                title="Good response"
                aria-label="Good response"
              >
                <FontAwesomeIcon icon={faThumbsUp} className="w-3.5 h-3.5" />
              </button>

              {/* Thumbs Down */}
              <button
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
                className={`w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${feedback === "down" ? "text-red-400" : ""}`}
                title="Bad response"
                aria-label="Bad response"
              >
                <FontAwesomeIcon icon={faThumbsDown} className="w-3.5 h-3.5" />
              </button>

              {/* Save to Library */}
              <button
                onClick={handleSaveToLibrary}
                className={`w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${savedToLibrary ? "text-[#8AB4F8]" : ""}`}
                title={savedToLibrary ? "Saved to Library" : "Save to Library"}
                aria-label={savedToLibrary ? "Saved to Library" : "Save to Library"}
              >
                <FontAwesomeIcon icon={faBookmark} className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* User Avatar */}
        {isUser && (
          <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-white/10">
            <FontAwesomeIcon icon={faUser} className="w-3 h-3" />
          </div>
        )}
      </div>
    </>
  );
}

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faCheck,
  faBolt,
  faDownload,
  faExpand,
  faXmark,
  faRotateRight,
  faPen,
} from "@fortawesome/free-solid-svg-icons";
import type { Message } from "../types/index.js";
import type { Components } from "react-markdown";

// Sanitize config: allow all safe markdown elements + code highlighting classes
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-/]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", /^hljs-/]],
    pre: [...(defaultSchema.attributes?.pre ?? []), ["className"]],
  },
};

interface Props {
  message: Message;
  streaming?: boolean;
  onRegenerate?: () => void;
  onEdit?: (content: string) => void;
  canRegenerate?: boolean;
}

// Custom link renderer — opens external links safely in new tab
function SafeLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <span>{children}</span>;
  const isHttp = href.startsWith("http://") || href.startsWith("https://");
  if (!isHttp && !href.startsWith("/") && !href.startsWith("#")) {
    // Reject javascript: and other unsafe protocols
    return <span className="text-gray-400">{children}</span>;
  }
  return (
    <a
      href={href}
      target={isHttp ? "_blank" : undefined}
      rel={isHttp ? "noopener noreferrer" : undefined}
      className="text-indigo-600 hover:text-indigo-700 underline"
      {...props}
    >
      {children}
    </a>
  );
}

// Code block with copy button
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const text = typeof children === "string" ? children : String(children ?? "");

  const copy = async () => {
    await navigator.clipboard.writeText(text.trimEnd());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code">
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 p-1.5 rounded bg-gray-700/80 hover:bg-gray-600 text-gray-300 hover:text-white transition-all cursor-pointer"
        title="Copy code"
        aria-label="Copy code"
      >
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={`w-3 h-3 ${copied ? "text-green-400" : ""}`} />
      </button>
      <code className={className}>{children}</code>
    </div>
  );
}

// Lightbox for generated images
function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
        aria-label="Close image viewer"
      >
        <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

const markdownComponents: Components = {
  a: SafeLink as Components["a"],
  pre: ({ children }) => <pre className="not-prose">{children}</pre>,
  code: ({ className, children, ...rest }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return <code className={className} {...rest}>{children}</code>;
  },
};

export default function MessageBubble({
  message,
  streaming,
  onRegenerate,
  onEdit,
  canRegenerate,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadImage = useCallback(() => {
    if (!message.imageDataUrl) return;
    const a = document.createElement("a");
    a.href = message.imageDataUrl;
    const ext = (message.mimeType ?? "image/png").split("/")[1] ?? "png";
    a.download = `obytgemini-image-${Date.now()}.${ext}`;
    a.click();
  }, [message.imageDataUrl, message.mimeType]);

  return (
    <>
      {lightboxOpen && message.imageDataUrl && (
        <ImageLightbox
          src={message.imageDataUrl}
          alt={message.content || "Generated image"}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className={`flex gap-3 group ${isUser ? "justify-end" : "justify-start"}`}>
        {/* Avatar — AI only */}
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5 select-none">
            <span className="text-white text-xs font-bold">O</span>
          </div>
        )}

        <div className={`flex flex-col gap-1 max-w-2xl min-w-0 ${isUser ? "items-end" : "items-start"}`}>
          {/* Attached image preview (user vision uploads) */}
          {message.attachmentDataUrl && (
            <img
              src={message.attachmentDataUrl}
              alt="Attached image"
              className="max-w-xs rounded-xl border border-gray-200 mb-1"
            />
          )}

          {/* Bubble */}
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed min-w-0 ${
              isUser
                ? "bg-indigo-600 text-white rounded-tr-sm"
                : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
            }`}
          >
            {message.imageDataUrl ? (
              <div className="space-y-2">
                <div className="relative group/img cursor-pointer" onClick={() => setLightboxOpen(true)}>
                  <img
                    src={message.imageDataUrl}
                    alt={message.content || "Generated image"}
                    className="max-w-full rounded-xl border border-gray-200 bg-gray-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/20 rounded-xl">
                    <FontAwesomeIcon icon={faExpand} className="w-6 h-6 text-white drop-shadow" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faExpand} className="w-3 h-3" />
                    View full size
                  </button>
                  <button
                    onClick={downloadImage}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faDownload} className="w-3 h-3" />
                    Download
                  </button>
                </div>
                {message.content && <p className="whitespace-pre-wrap text-gray-700 text-xs mt-1">{message.content}</p>}
              </div>
            ) : isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[
                    rehypeHighlight,
                    [rehypeSanitize, sanitizeSchema],
                  ]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
                {streaming && (
                  <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-0.5 rounded-sm" />
                )}
              </div>
            )}
          </div>

          {/* Meta row — AI messages */}
          {!isUser && !streaming && (
            <div className="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
              {message.provider && message.model && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <FontAwesomeIcon icon={faBolt} className="w-2.5 h-2.5" />
                  {message.provider}/{message.model}
                </span>
              )}
              <button
                onClick={copy}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                title="Copy response"
                aria-label="Copy response"
              >
                <FontAwesomeIcon
                  icon={copied ? faCheck : faCopy}
                  className={`w-3 h-3 ${copied ? "text-green-500" : ""}`}
                />
                {copied ? "Copied" : "Copy"}
              </button>
              {canRegenerate && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  title="Regenerate response"
                  aria-label="Regenerate response"
                >
                  <FontAwesomeIcon icon={faRotateRight} className="w-3 h-3" />
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Meta row — user messages: edit prompt */}
          {isUser && onEdit && !message.imageDataUrl && (
            <div className="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(message.content)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                title="Edit prompt"
                aria-label="Edit prompt"
              >
                <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Avatar — user */}
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 select-none">
            <span className="text-gray-600 text-xs font-semibold">U</span>
          </div>
        )}
      </div>
    </>
  );
}

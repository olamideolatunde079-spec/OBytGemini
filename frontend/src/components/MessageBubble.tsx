import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy, faCheck, faDownload, faExpand, faXmark,
  faUser, faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import type { Message } from "../types/index.js";
import type { Components } from "react-markdown";

/* ── sanitize: allow code highlight classes ── */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-/]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", /^hljs-/]],
    pre: [...(defaultSchema.attributes?.pre ?? []), ["className"]],
  },
};

/* ── safe external link ── */
function SafeLink({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <span>{children}</span>;
  const safe = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("/");
  if (!safe) return <span style={{ color: "var(--text-muted)" }}>{children}</span>;
  const ext = href.startsWith("http");
  return (
    <a
      href={href}
      target={ext ? "_blank" : undefined}
      rel={ext ? "noopener noreferrer" : undefined}
      style={{ color: "var(--brand-1)", textDecoration: "underline", textUnderlineOffset: 2 }}
      {...rest}
    >
      {children}
    </a>
  );
}

/* ── code block with copy button ── */
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
        className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-all"
        style={{ background: "rgba(255,255,255,0.1)", color: "#ccc" }}
        aria-label="Copy code"
      >
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-3 h-3" />
        {copied ? "Copied" : "Copy"}
      </button>
      <code className={className}>{children}</code>
    </div>
  );
}

/* ── image lightbox ── */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white"
        style={{ background: "rgba(255,255,255,0.15)" }}
        onClick={onClose}
        aria-label="Close"
      >
        <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

const mdComponents: Components = {
  a: SafeLink as Components["a"],
  pre: ({ children }) => <pre className="not-prose">{children}</pre>,
  code: ({ className, children }) => {
    if (className?.includes("language-")) return <CodeBlock className={className}>{children}</CodeBlock>;
    return <code className={className}>{children}</code>;
  },
};

/* ── provider label shortener ── */
function providerLabel(provider?: string | null, model?: string | null) {
  if (!provider) return null;
  const pmap: Record<string, string> = { google: "Gemini", openai: "GPT", groq: "Groq", anthropic: "Claude", deepseek: "DeepSeek" };
  const pName = pmap[provider] ?? provider;
  const mShort = model?.split("/").pop()?.split("-").slice(0, 3).join("-") ?? "";
  return `${pName} · ${mShort}`;
}

interface Props {
  message: Message;
  streaming?: boolean;
  onRegenerate?: () => void;
}

export default function MessageBubble({ message, streaming, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const isUser = message.role === "user";

  const copyResponse = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <Lightbox src={message.imageDataUrl} alt={message.content || "Generated image"} onClose={() => setLightbox(false)} />
      )}

      <div className={`flex gap-3 group py-1 ${isUser ? "justify-end" : "justify-start"}`}>

        {/* ── AI avatar: OBytGemini logo ── */}
        {!isUser && (
          <div className="flex-shrink-0 mt-0.5">
            <img
              src="/images/obytgemini-logo.png"
              alt="OBytGemini"
              className="w-8 h-8 rounded-full object-contain"
              style={{ background: "linear-gradient(135deg, #e8eeff, #f0e8ff)", padding: 2 }}
            />
          </div>
        )}

        <div className={`flex flex-col gap-1 min-w-0 ${isUser ? "items-end max-w-[80%]" : "items-start flex-1"}`}>

          {/* attachment preview above user bubble */}
          {isUser && message.attachmentDataUrl && (
            <img
              src={message.attachmentDataUrl}
              alt="Attached"
              className="max-w-xs rounded-2xl mb-1"
              style={{ border: "1px solid var(--border)" }}
            />
          )}

          {/* ── bubble ── */}
          <div
            className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
            style={isUser ? {
              background: "var(--bg-hover)",
              color: "var(--text-primary)",
              borderRadius: "18px 18px 4px 18px",
              maxWidth: "100%",
            } : {
              background: "transparent",
              color: "var(--text-primary)",
              width: "100%",
            }}
          >
            {message.imageDataUrl ? (
              /* generated image */
              <div className="space-y-2">
                <div className="relative group/img cursor-pointer" onClick={() => setLightbox(true)}>
                  <img
                    src={message.imageDataUrl}
                    alt={message.content || "Generated image"}
                    className="max-w-sm rounded-2xl"
                    style={{ border: "1px solid var(--border)" }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-2xl"
                    style={{ background: "rgba(0,0,0,0.25)" }}
                  >
                    <FontAwesomeIcon icon={faExpand} className="w-7 h-7 text-white drop-shadow" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setLightbox(true)} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--brand-1)" }}>
                    <FontAwesomeIcon icon={faExpand} className="w-3 h-3" /> View full size
                  </button>
                  <button onClick={downloadImage} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--brand-1)" }}>
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

          {/* ── AI meta row ── */}
          {!isUser && !streaming && (
            <div className="flex items-center gap-3 px-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
              {message.provider && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {providerLabel(message.provider, message.model)}
                </span>
              )}
              <button
                onClick={copyResponse}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                title="Copy response"
              >
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={`w-3.5 h-3.5 ${copied ? "text-green-500" : ""}`} />
                {copied ? "Copied" : "Copy"}
              </button>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                  title="Regenerate response"
                >
                  <FontAwesomeIcon icon={faRotateRight} className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── user avatar: clean icon (no letter U) ── */}
        {isUser && (
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
            style={{ background: "var(--bg-hover)" }}
          >
            <FontAwesomeIcon icon={faUser} className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
          </div>
        )}
      </div>
    </>
  );
}

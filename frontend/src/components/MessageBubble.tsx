import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faCheck, faBolt } from "@fortawesome/free-solid-svg-icons";
import type { Message } from "../types/index.js";

interface Props {
  message: Message;
  streaming?: boolean;
}

export default function MessageBubble({ message, streaming }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 group ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Avatar — AI only */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">O</span>
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-2xl ${isUser ? "items-end" : "items-start"}`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {message.imageDataUrl ? (
            <div className="space-y-2">
              <img
                src={message.imageDataUrl}
                alt={message.content || "Generated image"}
                className="max-w-full rounded-xl border border-gray-200 bg-gray-50"
              />
              {message.content && <p className="whitespace-pre-wrap text-gray-700">{message.content}</p>}
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {message.content}
              </ReactMarkdown>
              {streaming && (
                <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-0.5 rounded-sm" />
              )}
            </div>
          )}
        </div>

        {/* Meta row — AI messages only */}
        {!isUser && (
          <div className="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {message.provider && message.model && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <FontAwesomeIcon icon={faBolt} className="w-2.5 h-2.5" />
                {message.provider}/{message.model}
              </span>
            )}
            <button
              onClick={copy}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy response"
            >
              <FontAwesomeIcon
                icon={copied ? faCheck : faCopy}
                className={`w-3 h-3 ${copied ? "text-green-500" : ""}`}
              />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Avatar — user only */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-gray-600 text-xs font-semibold">U</span>
        </div>
      )}
    </div>
  );
}

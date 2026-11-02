import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import WelcomeScreen from "../components/WelcomeScreen.js";
import MessageBubble from "../components/MessageBubble.js";
import PromptComposer from "../components/PromptComposer.js";
import { useAuth } from "../hooks/useAuth.js";
import {
  fetchModels,
  fetchChat,
  createChat,
  generateImage,
  sendMessage,
  fetchConfig,
  fetchPreferences,
  savePreferences,
  runResearch,
  fetchResearchStatus,
} from "../lib/api.js";
import type { Chat, Message, ModelInfo } from "../types/index.js";

interface OutletCtx {
  refreshChats: () => void;
}

// Vision-capable models that accept image attachments
const VISION_PROVIDERS = new Set(["google", "openai"]);

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const { refreshChats } = useOutletContext<OutletCtx>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Model state ───────────────────────────────────────────────────────────
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [provider, setProvider] = useState("google");      // Gemini default
  const [model, setModel] = useState("gemini-3.8-flash");  // Gemini default
  const [loadingModels, setLoadingModels] = useState(true);
  // Track if preference was saved so we don't re-save on every keystroke
  const preferenceLoadedRef = useRef(false);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  // ── Composer state ────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [researchAvailable, setResearchAvailable] = useState(false);
  const [attachment, setAttachment] = useState<{
    dataUrl: string;
    mimeType: string;
  } | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedChatRef = useRef(false);
  const retainErrorOnNavigationRef = useRef(false);

  // ── Load models + user preferences (default to Gemini) ───────────────────
  useEffect(() => {
    let active = true;

    Promise.all([
      fetchModels(),
      fetchConfig().catch(() => null),
      fetchPreferences().catch(() => null),
      fetchResearchStatus().catch(() => null),
    ]).then(([modelList, config, pref, research]) => {
      if (!active) return;
      setModels(modelList);
      setLoadingModels(false);
      setResearchAvailable(Boolean(research?.available || config?.features?.research));

      // Already loaded a chat — its provider/model takes priority
      if (hasLoadedChatRef.current) return;

      // 1. User's saved preference
      if (pref?.preferredProvider && pref?.preferredModel) {
        const exists = modelList.some(
          (m) => m.provider === pref.preferredProvider && m.model === pref.preferredModel
        );
        if (exists) {
          setProvider(pref.preferredProvider);
          setModel(pref.preferredModel);
          preferenceLoadedRef.current = true;
          return;
        }
      }

      // 2. Server-advertised default (Gemini if key is valid)
      if (config?.defaults?.provider && config?.defaults?.model) {
        const defExists = modelList.some(
          (m) =>
            m.provider === config.defaults.provider &&
            m.model === config.defaults.model &&
            m.available
        );
        if (defExists) {
          setProvider(config.defaults.provider);
          setModel(config.defaults.model);
          return;
        }
      }

      // 3. First available model
      const first = modelList.find((m) => m.available);
      if (first) {
        setProvider(first.provider);
        setModel(first.model);
      }
    }).catch((err: Error) => {
      if (active) setModelsError(`Could not load models: ${err.message}`);
      setLoadingModels(false);
    });

    return () => { active = false; };
  }, []);

  // ── Load chat when chatId changes ─────────────────────────────────────────
  useEffect(() => {
    abortRef.current?.abort();
    let active = true;
    if (!chatId) {
      hasLoadedChatRef.current = false;
      setChat(null);
      setMessages([]);
      setLoadingChat(false);
      setAttachment(null);
      return () => { active = false; };
    }
    hasLoadedChatRef.current = true;
    setLoadingChat(true);
    if (retainErrorOnNavigationRef.current) {
      retainErrorOnNavigationRef.current = false;
    } else {
      setError(null);
    }
    fetchChat(chatId)
      .then(({ chat: c, messages: msgs }) => {
        if (!active) return;
        setChat(c);
        setMessages(msgs);
        setProvider(c.selectedProvider);
        setModel(c.selectedModel);
        setAttachment(null);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingChat(false);
      });
    return () => { active = false; };
  }, [chatId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // ── Model change — save preference immediately ────────────────────────────
  const handleModelChange = useCallback((p: string, m: string) => {
    setProvider(p);
    setModel(m);
    if (p !== "google" && p !== "openai") setImageMode(false);
    // Persist preference asynchronously (don't block UI)
    savePreferences({ preferredProvider: p, preferredModel: m }).catch(() => {
      // Silently ignore — preference save failure is non-critical
    });
  }, []);

  const handleEditPrompt = useCallback((content: string) => {
    setInput(content);
    setImageMode(false);
    setResearchMode(false);
  }, []);

  // ── Send a chat message ───────────────────────────────────────────────────
  const sendChatContent = useCallback(async (content: string, currentAttachment: typeof attachment) => {
    if ((!content && !currentAttachment) || generating) return;

    setError(null);
    setGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let activeChatId = chatId;
    if (!activeChatId) {
      try {
        const newChat = await createChat({ provider, model });
        activeChatId = newChat.id;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create chat");
        setGenerating(false);
        abortRef.current = null;
        return;
      }
    }

    if (controller.signal.aborted) {
      setGenerating(false);
      abortRef.current = null;
      refreshChats();
      return;
    }

    const optimisticMsg: Message = {
      id: `tmp-${Date.now()}`,
      chatId: activeChatId,
      role: "user",
      content: content || "(image attachment)",
      attachmentDataUrl: currentAttachment?.dataUrl ?? null,
      attachmentMimeType: currentAttachment?.mimeType ?? null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    setAttachment(null);
    setStreamingText("");

    let accumulated = "";
    let finalProvider = provider;
    let finalModel = model;
    let completed = false;
    let failureMessage: string | null = null;

    try {
      for await (const event of sendMessage(
        activeChatId,
        content || "(Analyze the attached image and describe what you see in detail.)",
        provider,
        model,
        controller.signal,
        currentAttachment?.dataUrl ?? null,
        currentAttachment?.mimeType ?? null
      )) {
        if (controller.signal.aborted) break;
        if (event.error) { failureMessage = event.error; break; }
        if (event.chunk) { accumulated += event.chunk; setStreamingText(accumulated); }
        if (event.done) {
          completed = true;
          finalProvider = event.provider ?? provider;
          finalModel = event.model ?? model;
        }
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        failureMessage = err instanceof Error ? err.message : "Streaming failed";
      }
    }

    if (completed) {
      const assistantMsg: Message = {
        id: `stream-${Date.now()}`,
        chatId: activeChatId,
        role: "assistant",
        content: accumulated,
        provider: finalProvider,
        model: finalModel,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      if (!controller.signal.aborted) {
        setError(
          failureMessage ??
            "The response stream ended before it was saved. Your prompt is still available to retry."
        );
      }
    }

    setStreamingText("");
    setGenerating(false);
    abortRef.current = null;
    if (!chatId && activeChatId && !controller.signal.aborted) {
      if (!completed) retainErrorOnNavigationRef.current = true;
      navigate(`/chat/${activeChatId}`, { replace: true });
    }
    refreshChats();
  }, [generating, chatId, provider, model, navigate, refreshChats]);

  const handleSubmit = useCallback(async () => {
    await sendChatContent(input.trim(), attachment);
  }, [sendChatContent, input, attachment]);

  const handleRegenerate = useCallback(
    async (assistantIndex: number) => {
      if (generating) return;
      const userMsg = [...messages]
        .slice(0, assistantIndex)
        .reverse()
        .find((m) => m.role === "user");
      if (!userMsg) {
        setError("Could not find the original prompt to regenerate.");
        return;
      }
      setMessages((prev) => prev.slice(0, assistantIndex));
      setImageMode(false);
      setResearchMode(false);
      await sendChatContent(userMsg.content, null);
    },
    [generating, messages, sendChatContent]
  );

  // ── Generate image ────────────────────────────────────────────────────────
  const handleGenerateImage = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || generating || (provider !== "google" && provider !== "openai")) return;

    setError(null);
    setGenerating(true);
    const promptMessage: Message = {
      id: `tmp-${Date.now()}`,
      chatId: chatId ?? "",
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, promptMessage]);

    try {
      const image = await generateImage({ provider: provider as "google" | "openai", prompt });
      setInput("");
      setMessages((prev) => [
        ...prev,
        {
          id: `image-${Date.now()}`,
          chatId: chatId ?? "",
          role: "assistant",
          content: prompt,
          provider: image.provider,
          model: image.model,
          imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
          mimeType: image.mimeType,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== promptMessage.id));
      setError(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [input, generating, provider, chatId]);

  // ── Web research ──────────────────────────────────────────────────────────
  const handleResearch = useCallback(async () => {
    const query = input.trim();
    if (!query || generating) return;
    if (!researchAvailable) {
      setError(
        "Web research is not configured. Add TAVILY_API_KEY to backend/.env (https://tavily.com)."
      );
      return;
    }

    setError(null);
    setGenerating(true);
    const promptMessage: Message = {
      id: `tmp-${Date.now()}`,
      chatId: chatId ?? "",
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, promptMessage]);

    try {
      const result = await runResearch(query);
      if (!result.researched) {
        throw new Error("Research did not complete.");
      }
      setInput("");
      const sourceLines = result.sources
        .map((s, i) => `${i + 1}. [${s.title}](${s.url})\n   ${s.snippet}`)
        .join("\n\n");
      const content = [
        result.answer ? `## Summary\n\n${result.answer}` : "## Summary\n\nNo concise answer was returned.",
        result.sources.length
          ? `## Sources\n\n${sourceLines}`
          : "## Sources\n\nNo sources were returned for this query.",
        `_${result.disclaimer}_`,
      ].join("\n\n");

      setMessages((prev) => [
        ...prev,
        {
          id: `research-${Date.now()}`,
          chatId: chatId ?? "",
          role: "assistant",
          content,
          provider: "research",
          model: "tavily",
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== promptMessage.id));
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setGenerating(false);
    }
  }, [input, generating, researchAvailable, chatId]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setError("Generation stopped. Your prompt was not saved to chat history.");
  };

  const composerSubmit = imageMode
    ? handleGenerateImage
    : researchMode
      ? handleResearch
      : handleSubmit;

  // ── Render ────────────────────────────────────────────────────────────────
  const isNewChat = !chatId;
  const hasMessages = messages.length > 0;
  const selectedModelAvailable = models.some(
    (m) => m.available && m.provider === provider && m.model === model
  );
  const modelAvailabilityError = loadingModels
    ? null
    : modelsError ??
      (models.length === 0
        ? "No models are registered. Check the backend configuration."
        : !models.some((m) => m.available)
          ? "No AI provider is configured. Add a provider API key to the backend environment."
          : !selectedModelAvailable
            ? `${provider === "google" ? "Gemini" : provider} is not available with the current API key. ` +
              (provider === "google"
                ? "Add a valid Google AI Studio key (starts with AIza) to backend/.env."
                : "Check the API key for this provider in backend/.env or choose a different model.")
            : null);
  const visibleError = error ?? modelAvailabilityError;

  const streamingMessage: Message | null =
    generating && streamingText
      ? {
          id: "streaming",
          chatId: chatId ?? "",
          role: "assistant",
          content: streamingText,
          provider,
          model,
          createdAt: new Date().toISOString(),
        }
      : null;

  const canAttachImages = VISION_PROVIDERS.has(provider) && selectedModelAvailable;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700 truncate max-w-xs">
          {chat?.title ?? (isNewChat ? "New Chat" : "…")}
        </h2>
        <span className="text-xs text-gray-400 hidden sm:block">OBytGemini</span>
      </header>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto">
        {loadingChat ? (
          <div className="flex flex-col gap-4 max-w-3xl mx-auto px-4 py-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                {i % 2 !== 0 && <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />}
                <div className={`h-12 rounded-2xl animate-pulse ${i % 2 === 0 ? "w-48 bg-indigo-100" : "w-64 bg-gray-100"}`} />
              </div>
            ))}
          </div>
        ) : isNewChat && !hasMessages ? (
          <WelcomeScreen
            userName={user?.name}
            onPrompt={(p) => setInput(p)}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, index) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onEdit={msg.role === "user" ? handleEditPrompt : undefined}
                canRegenerate={
                  msg.role === "assistant" &&
                  index === messages.length - 1 &&
                  !generating &&
                  !msg.imageDataUrl &&
                  msg.provider !== "research"
                }
                onRegenerate={
                  msg.role === "assistant"
                    ? () => handleRegenerate(index)
                    : undefined
                }
              />
            ))}
            {streamingMessage && (
              <MessageBubble message={streamingMessage} streaming />
            )}
            {generating && !streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 select-none">
                  <span className="text-white text-xs font-bold">O</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {visibleError && (
        <div className="mx-4 mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span className="flex-1 mr-2">{visibleError}</span>
          {error && (
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 font-bold flex-shrink-0 cursor-pointer"
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="flex-shrink-0 py-2">
        <PromptComposer
          value={input}
          onChange={setInput}
          onSubmit={composerSubmit}
          onCancel={imageMode || researchMode ? undefined : handleCancel}
          loading={generating}
          models={models}
          provider={provider}
          model={model}
          onModelChange={handleModelChange}
          imageMode={imageMode}
          canGenerateImages={
            (provider === "google" || provider === "openai") &&
            models.some((m) => m.provider === provider && m.available)
          }
          onImageModeChange={(enabled) => {
            setImageMode(enabled);
            if (enabled) setResearchMode(false);
          }}
          researchMode={researchMode}
          canResearch={researchAvailable}
          onResearchModeChange={(enabled) => {
            setResearchMode(enabled);
            if (enabled) setImageMode(false);
          }}
          attachment={attachment}
          onAttachmentChange={setAttachment}
          canAttachImages={canAttachImages}
          disabled={
            loadingChat ||
            loadingModels ||
            (researchMode ? false : !selectedModelAvailable)
          }
        />
      </div>
    </div>
  );
}

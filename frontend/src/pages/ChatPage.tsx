import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faArrowLeft,
  faPenToSquare,
  faXmark,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import SparkleIcon from "../components/SparkleIcon.js";
import WelcomeScreen from "../components/WelcomeScreen.js";
import MessageBubble from "../components/MessageBubble.js";
import PromptComposer from "../components/PromptComposer.js";
import { fetchModels, fetchChat, createChat, generateImage, sendMessage, fetchConfig, fetchPreferences, savePreferences } from "../lib/api.js";
import type { Chat, Message, ModelInfo } from "../types/index.js";

interface OutletCtx {
  refreshChats: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const VISION_PROVIDERS = new Set(["google", "openai"]);

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const { refreshChats, sidebarOpen, onToggleSidebar } = useOutletContext<OutletCtx>();
  const navigate = useNavigate();

  /* ── model state — start with working defaults immediately ── */
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [provider, setProvider] = useState("groq");           // fastest verified provider
  const [model, setModel] = useState("openai/gpt-oss-20b");  // fastest verified model
  const [loadingModels, setLoadingModels] = useState(true);
  const prefLoadedRef = useRef(false);

  /* ── chat state ── */
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  /* ── composer state ── */
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [attachment, setAttachment] = useState<{ dataUrl: string; mimeType: string } | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proModalOpen, setProModalOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatLoadedRef = useRef(false);
  const retainErrorRef = useRef(false);

  /* ── load models + preferences + config in background ── */
  /* The composer is NOT disabled during this load — defaults above work immediately */
  useEffect(() => {
    let active = true;
    // Load models first (fast, no DB)
    fetchModels().then(list => {
      if (!active) return;
      setModels(list);
      setLoadingModels(false);
      // Update provider/model only if user hasn't changed it and chat isn't loaded
      if (chatLoadedRef.current) return;
      if (prefLoadedRef.current) return;
      const first = list.find(m => m.available);
      if (first) { setProvider(first.provider); setModel(first.model); }
    }).catch((err: Error) => {
      if (active) { setModelsError(`Could not load models: ${err.message}`); setLoadingModels(false); }
    });

    // Load config + preferences in background (don't block UI)
    Promise.all([
      fetchConfig().catch(() => null),
      fetchPreferences().catch(() => null),
    ]).then(([config, pref]) => {
      if (!active || chatLoadedRef.current) return;
      // Apply saved preference if available
      if (pref?.preferredProvider && pref?.preferredModel) {
        prefLoadedRef.current = true;
        setProvider(pref.preferredProvider);
        setModel(pref.preferredModel);
        return;
      }
      // Apply server default
      if (config?.defaults?.provider && config?.defaults?.model) {
        setProvider(config.defaults.provider);
        setModel(config.defaults.model);
      }
    }).catch(() => {});

    return () => { active = false; };
  }, []);

  /* ── load chat when chatId changes ── */
  useEffect(() => {
    abortRef.current?.abort();
    let active = true;
    if (!chatId) {
      chatLoadedRef.current = false;
      setChat(null); setMessages([]); setLoadingChat(false); setAttachment(null);
      return () => { active = false; };
    }
    chatLoadedRef.current = true;
    setLoadingChat(true);
    if (!retainErrorRef.current) setError(null);
    retainErrorRef.current = false;
    fetchChat(chatId)
      .then(({ chat: c, messages: msgs }) => {
        if (!active) return;
        setChat(c); setMessages(msgs);
        setProvider(c.selectedProvider); setModel(c.selectedModel);
        setAttachment(null);
      })
      .catch((err: Error) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoadingChat(false); });
    return () => { active = false; };
  }, [chatId]);

  /* ── auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  /* ── model change → save preference ── */
  const handleModelChange = useCallback((p: string, m: string) => {
    setProvider(p); setModel(m);
    if (p !== "google" && p !== "openai") setImageMode(false);
    savePreferences({ preferredProvider: p, preferredModel: m }).catch(() => {});
  }, []);

  /* ── send message ── */
  const handleSubmit = useCallback(async (overrideText?: string) => {
    const content = (overrideText !== undefined ? overrideText : input).trim();
    if ((!content && !attachment) || generating) return;
    setError(null); setGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let activeChatId = chatId;
    if (!activeChatId) {
      try {
        const nc = await createChat({ provider, model });
        activeChatId = nc.id;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create chat");
        setGenerating(false); abortRef.current = null; return;
      }
    }
    if (controller.signal.aborted) { setGenerating(false); abortRef.current = null; refreshChats(); return; }

    const currentAttachment = attachment;
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, chatId: activeChatId, role: "user",
      content: content || "(image attachment)",
      attachmentDataUrl: currentAttachment?.dataUrl ?? null,
      attachmentMimeType: currentAttachment?.mimeType ?? null,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput(""); setAttachment(null); setStreamingText("");

    let accumulated = "", finalProvider = provider, finalModel = model;
    let completed = false, failMsg: string | null = null;
    let imageDataUrl: string | null = null;
    let imageMimeType: string | null = null;

    try {
      for await (const ev of sendMessage(
        activeChatId,
        content || "Analyze the attached image and describe what you see in detail.",
        provider, model, controller.signal,
        currentAttachment?.dataUrl ?? null,
        currentAttachment?.mimeType ?? null,
      )) {
        if (controller.signal.aborted) break;
        if (ev.error) { failMsg = ev.error; break; }
        if (ev.chunk) { accumulated += ev.chunk; setStreamingText(accumulated); }
        if (ev.image && ev.data) {
          imageDataUrl = `data:${ev.mimeType};base64,${ev.data}`;
          imageMimeType = ev.mimeType ?? "image/png";
        }
        if (ev.done) {
          completed = true;
          finalProvider = ev.provider ?? provider;
          finalModel = ev.model ?? model;
        }
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted)
        failMsg = err instanceof Error ? err.message : "Streaming failed";
    }

    if (completed) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, chatId: activeChatId!, role: "assistant",
        content: accumulated, provider: finalProvider, model: finalModel,
        imageDataUrl, mimeType: imageMimeType,
        createdAt: new Date().toISOString(),
      }]);
    } else {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      if (!controller.signal.aborted) setError(failMsg ?? "Response stream ended before completing.");
    }

    setStreamingText(""); setGenerating(false); abortRef.current = null;
    if (!chatId && activeChatId && !controller.signal.aborted) {
      if (!completed) retainErrorRef.current = true;
      navigate(`/chat/${activeChatId}`, { replace: true });
    }
    refreshChats();
  }, [input, attachment, generating, chatId, provider, model, navigate, refreshChats]);

  /* ── image generation ── */
  const handleGenerateImage = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || generating) return;
    setError(null); setGenerating(true);
    const promptMsg: Message = {
      id: `tmp-${Date.now()}`, chatId: chatId ?? "", role: "user",
      content: prompt, createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, promptMsg]);
    try {
      const img = await generateImage({ provider: provider as "google" | "openai", prompt });
      setInput("");
      setMessages(prev => [...prev, {
        id: `img-${Date.now()}`, chatId: chatId ?? "", role: "assistant",
        content: prompt, provider: img.provider, model: img.model,
        imageDataUrl: `data:${img.mimeType};base64,${img.data}`,
        mimeType: img.mimeType, createdAt: new Date().toISOString(),
      }]);
    } catch (err: unknown) {
      setMessages(prev => prev.filter(m => m.id !== promptMsg.id));
      setError(err instanceof Error ? err.message : "Image generation failed.");
    } finally { setGenerating(false); }
  }, [input, generating, provider, chatId]);

  const handleCancel = () => { abortRef.current?.abort(); };

  /* ── last AI message index for regenerate ── */
  const lastAiIdx = messages.map(m => m.role).lastIndexOf("assistant");

  const isNewChat = !chatId;
  const hasMessages = messages.length > 0;
  // Only disable if actively loading a CHAT, not while models load in background
  const selectedAvailable = models.length === 0
    ? true  // models not loaded yet — allow typing, validate on send
    : models.some(m => m.available && m.provider === provider && m.model === model);

  const availabilityError = (!loadingModels && models.length > 0) ? (
    modelsError ??
    (!models.some(m => m.available)
      ? "No AI provider configured. Add an API key to backend/.env."
      : null)
  ) : null;
  const visibleError = error ?? availabilityError;

  const streamingMsg: Message | null = generating && streamingText
    ? { id: "streaming", chatId: chatId ?? "", role: "assistant", content: streamingText, provider, model, createdAt: new Date().toISOString() }
    : null;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--bg-base)" }}>

      {/* ── top bar ── */}
      <header
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-light)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* sidebar toggle (shown when sidebar is closed) — hidden on mobile when in a chat */}
          {!sidebarOpen && !chatId && (
            <button
              onClick={onToggleSidebar}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              aria-label="Open sidebar"
            >
              <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
            </button>
          )}

          {/* Back button — visible on mobile (when sidebar is closed and we're in a chat) */}
          {chatId && (
            <button
              onClick={() => navigate("/")}
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              aria-label="Back to home"
              title="Back"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
            </button>
          )}

          <h2
            className="text-sm font-medium truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {chat?.title ?? (isNewChat ? "OBytGemini" : "…")}
          </h2>
        </div>

        {/* Top Right Action Area */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-white transition-all shadow-sm hover:brightness-110 active:scale-95 cursor-pointer"
            style={{ background: "#1c3aa9" }}
          >
            <SparkleIcon className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">Upgrade to OBytGemini Pro</span>
            <span className="sm:hidden">Pro</span>
          </button>

          <button
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="New Chat"
            aria-label="New chat"
          >
            <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── message area ── */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {loadingChat ? (
          /* skeleton loader */
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 w-full">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "justify-end"}`}>
                {i % 2 === 0 && <div className="w-8 h-8 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--bg-hover)" }} />}
                <div className={`h-14 rounded-2xl animate-pulse ${i % 2 === 0 ? "w-72" : "w-48"}`} style={{ background: "var(--bg-hover)" }} />
              </div>
            ))}
          </div>
        ) : isNewChat && !hasMessages ? (
          <WelcomeScreen
            onPrompt={p => {
              setInput(p);
              handleSubmit(p);
            }}
            input={input}
            setInput={setInput}
            onSubmit={() => (imageMode ? handleGenerateImage() : handleSubmit())}
            loading={generating}
            models={models}
            provider={provider}
            model={model}
            onModelChange={handleModelChange}
            attachment={attachment}
            onAttachmentChange={setAttachment}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4 pt-6 pb-4 space-y-2 w-full flex-1">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRegenerate={idx === lastAiIdx && !generating ? () => {
                  /* remove last AI message, re-submit last user message */
                  const lastUser = [...messages].reverse().find(m => m.role === "user");
                  if (!lastUser) return;
                  setMessages(prev => prev.filter(m => m.id !== msg.id));
                  setInput(lastUser.content);
                } : undefined}
              />
            ))}
            {streamingMsg && <MessageBubble message={streamingMsg} streaming />}

            {/* typing indicator while waiting for first chunk */}
            {generating && !streamingText && (
              <div className="flex gap-3 py-1">
                <img
                  src="/images/obytgemini-logo.png"
                  alt="OBytGemini"
                  className="w-8 h-8 rounded-full object-contain flex-shrink-0 mt-0.5"
                  style={{ background: "linear-gradient(135deg,#e8eeff,#f0e8ff)", padding: 2 }}
                />
                <div
                  className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }}
                >
                  {[0, 150, 300].map(delay => (
                    <span
                      key={delay}
                      className="w-2 h-2 rounded-full animate-bounce"
                      style={{ background: "var(--text-muted)", animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── error banner ── */}
      {visibleError && (
        <div
          className="mx-4 mb-2 px-4 py-2.5 rounded-2xl text-sm flex items-start gap-2"
          style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}
        >
          <span className="flex-1">{visibleError}</span>
          {error && (
            <button
              onClick={() => setError(null)}
              className="font-bold text-lg leading-none flex-shrink-0 cursor-pointer"
              style={{ color: "var(--error-text)" }}
              aria-label="Dismiss"
            >×</button>
          )}
        </div>
      )}

      {/* ── composer (only when in active conversation) ── */}
      {(!isNewChat || hasMessages) && (
        <div className="flex-shrink-0 py-2">
          <PromptComposer
            value={input}
            onChange={setInput}
            onSubmit={imageMode ? handleGenerateImage : () => handleSubmit()}
            onCancel={handleCancel}
            loading={generating}
            models={models}
            provider={provider}
            model={model}
            onModelChange={handleModelChange}
            imageMode={imageMode}
            canGenerateImages={(provider === "google" || provider === "openai") && models.some(m => m.provider === provider && m.available)}
            onImageModeChange={setImageMode}
            attachment={attachment}
            onAttachmentChange={setAttachment}
            canAttachImages={VISION_PROVIDERS.has(provider) && selectedAvailable}
            
          />
        </div>
      )}

      {/* ── OBytGemini Pro Upgrade Modal ── */}
      {proModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setProModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl border relative flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150"
            style={{ background: "var(--bg-sidebar)", borderColor: "var(--border-subtle)" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setProModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[#1c3aa9] text-white">
                <SparkleIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-[var(--text-primary)]">OBytGemini Pro</h3>
                <p className="text-xs text-[var(--text-secondary)]">Elevate your AI productivity</p>
              </div>
            </div>

            <div className="space-y-3 py-2 text-sm text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5">
                <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-[var(--accent-blue)] mt-1 shrink-0" />
                <span><strong className="text-[var(--text-primary)]">Expanded Context & Limits:</strong> Up to 1M+ token context windows for deep document and codebase analysis.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-[var(--accent-blue)] mt-1 shrink-0" />
                <span><strong className="text-[var(--text-primary)]">Multi-Model Reasoning:</strong> Full access to Gemini 1.5 Pro, Claude 3.5 Sonnet, GPT-4o, and DeepSeek R1.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-[var(--accent-blue)] mt-1 shrink-0" />
                <span><strong className="text-[var(--text-primary)]">Creative Studio:</strong> Dedicated Image generator with multiple aspect ratios and style presets.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-[var(--accent-blue)] mt-1 shrink-0" />
                <span><strong className="text-[var(--text-primary)]">Study & Scheduling:</strong> AI flashcards, quizzes, automated recurring prompts, and unlimited notebooks.</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  alert("You're using OBytGemini Pro! All features and endpoints are fully unlocked.");
                  setProModalOpen(false);
                }}
                className="w-full py-2.5 rounded-full text-white text-sm font-medium transition-all shadow hover:brightness-110 active:scale-[0.98] cursor-pointer"
                style={{ background: "#1c3aa9" }}
              >
                Start 14-day free trial
              </button>
              <button
                onClick={() => setProModalOpen(false)}
                className="w-full py-2 rounded-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

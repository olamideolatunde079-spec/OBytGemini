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
} from "../lib/api.js";
import type { Chat, Message, ModelInfo } from "../types/index.js";

interface OutletCtx {
  refreshChats: () => void;
}

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const { refreshChats } = useOutletContext<OutletCtx>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Model state
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [provider, setProvider] = useState("google");
  const [model, setModel] = useState("gemini-3.8-flash");
  const [loadingModels, setLoadingModels] = useState(true);

  // Chat state
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  // Composer state
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Auto-scroll ref
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedChatRef = useRef(false);
  const retainErrorOnNavigationRef = useRef(false);

  // ── Load available models once ────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    fetchModels()
      .then((list) => {
        if (!active) return;
        setModels(list);
        const first = list.find((m) => m.available);
        if (first && !hasLoadedChatRef.current) {
          setProvider(first.provider);
          setModel(first.model);
        }
      })
      .catch((err: Error) => {
        if (active) setModelsError(`Could not load models: ${err.message}`);
      })
      .finally(() => {
        if (active) setLoadingModels(false);
      });
    return () => {
      active = false;
    };
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
      return () => {
        active = false;
      };
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
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingChat(false);
      });
    return () => {
      active = false;
    };
  }, [chatId]);

  // ── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // ── Submit a message ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const content = input.trim();
    if (!content || generating) return;

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

    // Optimistic user message
    const optimisticMsg: Message = {
      id: `tmp-${Date.now()}`,
      chatId: activeChatId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Stream AI response
    setStreamingText("");
    let accumulated = "";
    let finalProvider = provider;
    let finalModel = model;
    let completed = false;
    let failureMessage: string | null = null;

    try {
      for await (const event of sendMessage(
        activeChatId,
        content,
        provider,
        model,
        controller.signal
      )) {
        if (controller.signal.aborted) break;

        if (event.error) {
          failureMessage = event.error;
          break;
        }
        if (event.chunk) {
          accumulated += event.chunk;
          setStreamingText(accumulated);
        }
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
      setInput("");
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
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMsg.id));
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
    refreshChats(); // Refresh sidebar titles
  }, [input, generating, chatId, provider, model, navigate, refreshChats]);

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
    setMessages((previous) => [...previous, promptMessage]);

    try {
      const image = await generateImage({ provider, prompt });
      setInput("");
      setMessages((previous) => [
        ...previous,
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
      setMessages((previous) =>
        previous.filter((message) => message.id !== promptMessage.id)
      );
      setError(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [input, generating, provider, chatId]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setError("Generation stopped. Your prompt was not added to chat history.");
  };

  const handleModelChange = (p: string, m: string) => {
    setProvider(p);
    setModel(m);
    if (p !== "google" && p !== "openai") setImageMode(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const isNewChat = !chatId;
  const hasMessages = messages.length > 0;
  const selectedModelAvailable = models.some(
    (item) =>
      item.available && item.provider === provider && item.model === model
  );
  const modelAvailabilityError = loadingModels
    ? null
    : modelsError ??
      (models.length === 0
        ? "No models are registered. Check the backend configuration."
        : !models.some((item) => item.available)
          ? "No AI provider is configured. Add a provider API key to the backend environment."
          : !selectedModelAvailable
            ? "The selected model is unavailable. Choose a configured model to continue."
          : null);
  const visibleError = error ?? modelAvailabilityError;

  // Synthesise a "streaming" message for the bubble list
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
          <div className="flex items-center justify-center h-full">
            <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : isNewChat && !hasMessages ? (
          <WelcomeScreen
            userName={user?.name}
            onPrompt={(p) => {
              setInput(p);
            }}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {streamingMessage && (
              <MessageBubble message={streamingMessage} streaming />
            )}
            {/* Loading indicator when waiting for first token */}
            {generating && !streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
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
          <span>{visibleError}</span>
          {error && (
            <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600 font-bold">
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
          onSubmit={imageMode ? handleGenerateImage : handleSubmit}
          onCancel={imageMode ? undefined : handleCancel}
          loading={generating}
          models={models}
          provider={provider}
          model={model}
          onModelChange={handleModelChange}
          imageMode={imageMode}
          canGenerateImages={
            (provider === "google" || provider === "openai") &&
            models.some((item) => item.provider === provider && item.available)
          }
          onImageModeChange={setImageMode}
          disabled={loadingChat || loadingModels || !selectedModelAvailable}
        />
      </div>
    </div>
  );
}

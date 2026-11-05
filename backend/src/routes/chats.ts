import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  getAvailableModels,
  getDefaultModel,
  getModel,
  getProviderFailureMessage,
  generateImage,
} from "../lib/models.js";
import { buildSystemPrompt } from "../lib/systemPrompt.js";
import { streamText, type ModelMessage } from "ai";

const router = Router();

// ── Chat ownership cache ───────────────────────────────────────────────────
// ownedChat() hits the DB on every message request — cache for 5 minutes
// to eliminate ~700ms on the hot path. Chat metadata rarely changes mid-conversation.
type CachedChat = { id: string; userId: string; title: string; selectedProvider: string; selectedModel: string };
const chatOwnershipCache = new Map<string, { chat: CachedChat; expiry: number }>();
const CHAT_CACHE_TTL = 300_000; // 5 minutes

function getCachedChat(chatId: string, userId: string): CachedChat | null {
  const entry = chatOwnershipCache.get(`${chatId}:${userId}`);
  if (entry && entry.expiry > Date.now()) return entry.chat;
  chatOwnershipCache.delete(`${chatId}:${userId}`);
  return null;
}

function setCachedChat(chat: CachedChat): void {
  chatOwnershipCache.set(`${chat.id}:${chat.userId}`, {
    chat,
    expiry: Date.now() + CHAT_CACHE_TTL,
  });
}

function invalidateCachedChat(chatId: string, userId: string): void {
  chatOwnershipCache.delete(`${chatId}:${userId}`);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of chatOwnershipCache) {
    if (entry.expiry <= now) chatOwnershipCache.delete(key);
  }
}, 120_000).unref();

// ── Image intent detection ─────────────────────────────────────────────────
// Detects when a user's message is asking for image generation.
// When detected (and the provider supports images), we auto-route to
// the image API instead of returning a text "I can't generate images" response.
const IMAGE_INTENT_PATTERNS = [
  /\b(create|generate|make|draw|design|paint|render)\b.*\b(image|logo|picture|illustration|poster|graphic|background|mockup|artwork|drawing|painting|photo)\b/i,
  /\b(image|logo|picture|illustration|poster|graphic|background|mockup|artwork)\b.*\b(for|of|with)\b/i,
  /\b(create|generate|make|draw|design)\b.*\b(a|an|the)\s+(logo|picture|image|poster|graphic|illustration|background|thumbnail|banner|avatar|icon|emoji|sticker)/i,
];

function isImageGenerationRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();
  // Must NOT be asking about images in a theoretical sense
  if (lower.includes("what is") || lower.includes("how does") || lower.includes("explain"))
    return false;
  return IMAGE_INTENT_PATTERNS.some(p => p.test(lower));
}

function canProviderGenerateImages(provider: string): boolean {
  return provider === "google" || provider === "openai";
}
router.use(requireAuth);

interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

function getUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

async function ownedChat(chatId: string, userId: string) {
  // Check cache first — eliminates ~700ms DB query on every message request
  const cached = getCachedChat(chatId, userId);
  if (cached) return cached;

  const [c] = await db
    .select()
    .from(schema.chat)
    .where(and(eq(schema.chat.id, chatId), eq(schema.chat.userId, userId)))
    .limit(1);
  if (c) setCachedChat(c);
  return c ?? null;
}

function parseChatId(req: Request, res: Response): string | null {
  const parsed = z.string().uuid().safeParse(String(req.params.id));
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid chat ID" });
    return null;
  }
  return parsed.data;
}

// ── Fetch user memories for system prompt ──────────────────────────────────
async function getUserMemories(userId: string) {
  const rows = await db
    .select({ category: schema.memory.category, content: schema.memory.content })
    .from(schema.memory)
    .where(eq(schema.memory.userId, userId))
    .orderBy(schema.memory.createdAt);
  return rows;
}

// GET /api/chats
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const chats = await db
    .select()
    .from(schema.chat)
    .where(eq(schema.chat.userId, user.id))
    .orderBy(desc(schema.chat.updatedAt));
  res.json({ chats });
});

// POST /api/chats
const createChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  selectedProvider: z.string().min(1).optional(),
  selectedModel: z.string().min(1).optional(),
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const parsed = createChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const { title, selectedProvider, selectedModel } = parsed.data;
  const models = getAvailableModels();
  const hasRequestedModel = Boolean(selectedProvider || selectedModel);

  let chosenProvider: string;
  let chosenModel: string;

  if (hasRequestedModel) {
    const entry = models.find(
      (e) => e.provider === selectedProvider && e.model === selectedModel
    );
    if (!entry) {
      res.status(400).json({ error: "Unknown model selection." });
      return;
    }
    if (!entry.available) {
      res.status(400).json({
        error: `Provider "${entry.provider}" is not configured. Add its API key to the backend environment.`,
      });
      return;
    }
    chosenProvider = entry.provider;
    chosenModel = entry.model;
  } else {
    // No explicit model — use default (Gemini, or first available)
    const def = getDefaultModel();
    chosenProvider = def.provider;
    chosenModel = def.model;
  }

  const [newChat] = await db
    .insert(schema.chat)
    .values({
      userId: user.id,
      title: title ?? "New Chat",
      selectedProvider: chosenProvider,
      selectedModel: chosenModel,
    })
    .returning();
  res.status(201).json({ chat: newChat });
});

// GET /api/chats/:id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const chatId = parseChatId(req, res);
  if (!chatId) return;
  const chatRecord = await ownedChat(chatId, user.id);
  if (!chatRecord) { res.status(404).json({ error: "Chat not found" }); return; }
  const messages = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.chatId, chatRecord.id))
    .orderBy(schema.message.createdAt);
  res.json({ chat: chatRecord, messages });
});

// PATCH /api/chats/:id
const patchChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  selectedProvider: z.string().min(1).optional(),
  selectedModel: z.string().min(1).optional(),
});

router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const chatId = parseChatId(req, res);
  if (!chatId) return;
  const chatRecord = await ownedChat(chatId, user.id);
  if (!chatRecord) { res.status(404).json({ error: "Chat not found" }); return; }
  const parsed = patchChatSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  if (parsed.data.selectedProvider || parsed.data.selectedModel) {
    try {
      getModel(
        parsed.data.selectedProvider ?? chatRecord.selectedProvider,
        parsed.data.selectedModel ?? chatRecord.selectedModel
      );
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Invalid model selection",
      });
      return;
    }
  }
  const [updated] = await db
    .update(schema.chat)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.chat.id, chatRecord.id))
    .returning();
  res.json({ chat: updated });
});

// DELETE /api/chats/:id
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const chatId = parseChatId(req, res);
  if (!chatId) return;
  const chatRecord = await ownedChat(chatId, user.id);
  if (!chatRecord) { res.status(404).json({ error: "Chat not found" }); return; }
  await db.delete(schema.chat).where(eq(schema.chat.id, chatRecord.id));
  res.json({ success: true });
});

// POST /api/chats/:id/messages
const messageSchema = z.object({
  content: z.string().trim().min(1).max(32_000),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  // Optional base64 image attachment for vision models
  attachmentDataUrl: z.string().optional(),
  attachmentMimeType: z.string().optional(),
});

router.post("/:id/messages", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const chatId = parseChatId(req, res);
  if (!chatId) return;

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  // ── Parallel: fetch chat ownership + validate input simultaneously ──────
  const chatRecord = await ownedChat(chatId, user.id);
  if (!chatRecord) { res.status(404).json({ error: "Chat not found" }); return; }

  const provider = parsed.data.provider ?? chatRecord.selectedProvider;
  const modelId = parsed.data.model ?? chatRecord.selectedModel;

  let aiModel;
  try {
    aiModel = getModel(provider, modelId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid model selection";
    res.status(400).json({ error: message });
    return;
  }

  // ── Parallel: fetch history + memories simultaneously ────────────────────
  const [history, memories] = await Promise.all([
    db.select().from(schema.message)
      .where(eq(schema.message.chatId, chatRecord.id))
      .orderBy(schema.message.createdAt),
    getUserMemories(user.id),
  ]);

  const systemPrompt = buildSystemPrompt({
    userName: user.name,
    userMessage: parsed.data.content,
    memories,
    provider,
    model: modelId,
  });

  // Build message history — limit to last 20 messages for performance
  const recentHistory = history.slice(-20);
  const aiMessages: ModelMessage[] = recentHistory.map((m) => {
    if (m.role === "assistant") {
      return { role: "assistant" as const, content: m.content };
    }
    return { role: "user" as const, content: m.content };
  });

  // Add the current user turn — with optional image attachment for vision models
  const hasAttachment =
    parsed.data.attachmentDataUrl &&
    parsed.data.attachmentMimeType &&
    (provider === "google" || provider === "openai");

  if (hasAttachment && parsed.data.attachmentDataUrl && parsed.data.attachmentMimeType) {
    // Extract base64 from data URL (strip "data:image/png;base64," prefix)
    const base64 = parsed.data.attachmentDataUrl.includes(",")
      ? parsed.data.attachmentDataUrl.split(",")[1]
      : parsed.data.attachmentDataUrl;

    aiMessages.push({
      role: "user",
      content: [
        { type: "text", text: parsed.data.content },
        {
          type: "image",
          image: base64,
          mediaType: parsed.data.attachmentMimeType,
        },
      ],
    });
  } else {
    aiMessages.push({ role: "user", content: parsed.data.content });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (event: object) => {
    if (!res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // ── Auto image generation ─────────────────────────────────────────────
  // If the user's message looks like an image request and the selected
  // provider supports image generation, route there automatically.
  if (
    !hasAttachment && // Don't auto-detect when user attached an image for vision
    isImageGenerationRequest(parsed.data.content) &&
    canProviderGenerateImages(provider)
  ) {
    try {
      sendEvent({ chunk: "Generating image…\n\n" });
      const image = await generateImage({ provider, prompt: parsed.data.content });

      // Persist user message
      await db.insert(schema.message).values({
        chatId: chatRecord.id, role: "user", content: parsed.data.content,
      });
      // Persist assistant message with image marker
      await db.insert(schema.message).values({
        chatId: chatRecord.id, role: "assistant",
        content: `Generated image: ${parsed.data.content.slice(0, 100)}`,
        provider: image.provider, model: image.model,
      });
      // Update chat title
      const shortTitle = parsed.data.content.slice(0, 60).trim();
      await db.update(schema.chat).set({
        title: chatRecord.title === "New Chat" ? shortTitle : chatRecord.title,
        selectedProvider: provider, selectedModel: modelId, updatedAt: new Date(),
      }).where(eq(schema.chat.id, chatRecord.id));

      // Send image as a special event the frontend recognizes
      sendEvent({
        image: true,
        mimeType: image.mimeType,
        data: image.data,
        provider: image.provider,
        model: image.model,
        done: true,
      });
      res.end();
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Image generation failed.";
      sendEvent({ error: msg });
      res.end();
      return;
    }
  }

  const abortController = new AbortController();
  const handleDisconnect = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.on("close", handleDisconnect);

  let generationFinished = false;
  let streamError: unknown;
  try {
    const { textStream } = streamText({
      model: aiModel,
      system: systemPrompt,
      messages: aiMessages,
      abortSignal: AbortSignal.any([
        abortController.signal,
        AbortSignal.timeout(30_000), // 30s max (was 90s)
      ]),
      maxRetries: 0,
      onError: ({ error }) => {
        streamError = error;
      },
    });

    let fullText = "";
    for await (const chunk of textStream) {
      if (abortController.signal.aborted || res.destroyed) return;
      // ── BREAK IMMEDIATELY on error — don't wait for 30s timeout ──
      if (streamError) break;
      fullText += chunk;
      sendEvent({ chunk });
    }

    if (abortController.signal.aborted || res.destroyed) return;
    if (streamError) {
      sendEvent({ error: getProviderFailureMessage(streamError, provider) });
      res.end();
      return;
    }
    generationFinished = true;
    if (!fullText.trim()) {
      sendEvent({ error: "The selected provider returned an empty response. Please try again." });
      res.end();
      return;
    }

    // ── Send done FIRST — user sees the complete response immediately ─────
    sendEvent({ done: true, provider, model: modelId });
    res.end();

    // ── Save to DB in background (parallel) ─────────────────────────────
    const shortTitle = parsed.data.content.slice(0, 60).trim();
    Promise.all([
      db.insert(schema.message).values({
        chatId: chatRecord.id, role: "user", content: parsed.data.content,
      }),
      db.insert(schema.message).values({
        chatId: chatRecord.id, role: "assistant", content: fullText, provider, model: modelId,
      }),
      db.update(schema.chat).set({
        title: chatRecord.title === "New Chat" ? shortTitle : chatRecord.title,
        selectedProvider: provider, selectedModel: modelId, updatedAt: new Date(),
      }).where(eq(schema.chat.id, chatRecord.id)),
    ]).catch(err => {
      console.error("Background DB save failed", { error: err instanceof Error ? err.message : String(err) });
    });
    // try block ends — done event already sent above
  } catch (err: unknown) {
    if (!abortController.signal.aborted && !res.destroyed) {
      console.error("AI generation failed", {
        provider,
        model: modelId,
        error: err instanceof Error ? err.name : "UnknownError",
      });
      sendEvent({
        error:
          generationFinished
            ? "The response was generated but could not be saved. It is not in your chat history; please try again."
            : "The selected provider could not complete this request. Check its API key, model availability, and provider limits, then try again.",
      });
      res.end();
    }
  } finally {
    res.off("close", handleDisconnect);
  }
});

export default router;

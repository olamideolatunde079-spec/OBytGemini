import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getAvailableModels, getModel } from "../lib/models.js";
import { streamText } from "ai";

const router = Router();
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

// Helper — verify ownership
async function ownedChat(chatId: string, userId: string) {
  const [c] = await db
    .select()
    .from(schema.chat)
    .where(and(eq(schema.chat.id, chatId), eq(schema.chat.userId, userId)))
    .limit(1);
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

// GET /api/chats — list authenticated user's chats
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const chats = await db
    .select()
    .from(schema.chat)
    .where(eq(schema.chat.userId, user.id))
    .orderBy(desc(schema.chat.updatedAt));
  res.json({ chats });
});

// POST /api/chats — create a new chat
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
  const selectedEntry =
    hasRequestedModel
      ? models.find(
          (entry) =>
            entry.provider === selectedProvider && entry.model === selectedModel
        )
      : models.find((entry) => entry.available) ?? models[0];
  if (!selectedEntry) {
    res
      .status(hasRequestedModel ? 400 : 503)
      .json({ error: hasRequestedModel ? "Unknown model selection." : "No AI models are available." });
    return;
  }
  if (hasRequestedModel && !selectedEntry.available) {
    res.status(400).json({
      error: `Provider "${selectedEntry.provider}" is not configured. Add its API key to the backend environment.`,
    });
    return;
  }

  const [newChat] = await db
    .insert(schema.chat)
    .values({
      userId: user.id,
      title: title ?? "New Chat",
      selectedProvider: selectedEntry.provider,
      selectedModel: selectedEntry.model,
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
});

router.post("/:id/messages", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const chatId = parseChatId(req, res);
  if (!chatId) return;
  const chatRecord = await ownedChat(chatId, user.id);
  if (!chatRecord) { res.status(404).json({ error: "Chat not found" }); return; }

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

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

  const history = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.chatId, chatRecord.id))
    .orderBy(schema.message.createdAt);

  const aiMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  aiMessages.push({ role: "user", content: parsed.data.content });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const abortController = new AbortController();
  const handleDisconnect = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.on("close", handleDisconnect);

  const sendEvent = (event: object) => {
    if (!res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let generationFinished = false;
  try {
    const { textStream } = streamText({
      model: aiModel,
      messages: aiMessages,
      abortSignal: AbortSignal.any([
        abortController.signal,
        AbortSignal.timeout(90_000),
      ]),
      maxRetries: 0,
    });

    let fullText = "";
    for await (const chunk of textStream) {
      if (abortController.signal.aborted || res.destroyed) return;
      fullText += chunk;
      sendEvent({ chunk });
    }

    if (abortController.signal.aborted || res.destroyed) return;
    generationFinished = true;
    if (!fullText.trim()) {
      sendEvent({ error: "The selected provider returned an empty response. Please try again." });
      res.end();
      return;
    }

    await db.transaction(async (tx) => {
      await tx.insert(schema.message).values({
        chatId: chatRecord.id,
        role: "user",
        content: parsed.data.content,
      });
      await tx.insert(schema.message).values({
        chatId: chatRecord.id,
        role: "assistant",
        content: fullText,
        provider,
        model: modelId,
      });

      const shortTitle = parsed.data.content.slice(0, 60).trim();
      await tx
        .update(schema.chat)
        .set({
          title: chatRecord.title === "New Chat" ? shortTitle : chatRecord.title,
          selectedProvider: provider,
          selectedModel: modelId,
          updatedAt: new Date(),
        })
        .where(eq(schema.chat.id, chatRecord.id));
    });

    sendEvent({ done: true, provider, model: modelId });
    res.end();
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

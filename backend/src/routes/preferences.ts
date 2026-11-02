/**
 * /api/preferences — user model preference persistence
 * /api/memories    — user memory CRUD
 * /api/profile     — public builder profile
 */
import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getAvailableModels, getDefaultModel } from "../lib/models.js";
import { BUILDER_PROFILE } from "../lib/builderProfile.js";

const router = Router();

interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}
const getUser = (req: Request): AuthUser =>
  (req as Request & { user: AuthUser }).user;

// ── GET /api/profile — public builder profile (no auth) ───────────────────
router.get("/profile", (_req, res) => {
  res.json({ profile: BUILDER_PROFILE });
});

// All routes below require auth
router.use(requireAuth);

// ── GET /api/preferences — get or create user preferences ─────────────────
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const [pref] = await db
    .select()
    .from(schema.userPreference)
    .where(eq(schema.userPreference.userId, user.id))
    .limit(1);

  if (!pref) {
    // Return defaults without creating a row yet
    const def = getDefaultModel();
    res.json({
      preference: {
        preferredProvider: def.provider,
        preferredModel: def.model,
        settings: {},
      },
    });
    return;
  }

  res.json({ preference: pref });
});

// ── PUT /api/preferences — save user preferences ──────────────────────────
const prefSchema = z.object({
  preferredProvider: z.string().min(1),
  preferredModel: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

router.put("/", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const parsed = prefSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  // Validate the provider/model exists
  const models = getAvailableModels();
  const entry = models.find(
    (m) => m.provider === parsed.data.preferredProvider && m.model === parsed.data.preferredModel
  );
  if (!entry) {
    res.status(400).json({ error: "Unknown provider/model combination." });
    return;
  }

  const [existing] = await db
    .select({ id: schema.userPreference.id })
    .from(schema.userPreference)
    .where(eq(schema.userPreference.userId, user.id))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.userPreference)
      .set({
        preferredProvider: parsed.data.preferredProvider,
        preferredModel: parsed.data.preferredModel,
        settings: parsed.data.settings ?? {},
        updatedAt: new Date(),
      })
      .where(eq(schema.userPreference.userId, user.id))
      .returning();
    res.json({ preference: updated });
  } else {
    const [created] = await db
      .insert(schema.userPreference)
      .values({
        userId: user.id,
        preferredProvider: parsed.data.preferredProvider,
        preferredModel: parsed.data.preferredModel,
        settings: parsed.data.settings ?? {},
      })
      .returning();
    res.json({ preference: created });
  }
});

// ── GET /api/memories — list user memories ────────────────────────────────
router.get("/memories", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const items = await db
    .select()
    .from(schema.memory)
    .where(eq(schema.memory.userId, user.id))
    .orderBy(schema.memory.createdAt);
  res.json({ memories: items });
});

// ── POST /api/memories — create a memory ──────────────────────────────────
const memorySchema = z.object({
  category: z.enum(["name", "preference", "project", "interest", "instruction", "other"]),
  content: z.string().min(1).max(500),
});

router.post("/memories", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const parsed = memorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(schema.memory)
    .values({
      userId: user.id,
      category: parsed.data.category,
      content: parsed.data.content,
    })
    .returning();
  res.status(201).json({ memory: created });
});

// ── PATCH /api/memories/:id — update a memory ────────────────────────────
router.patch("/memories/:id", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const memId = z.string().uuid().safeParse(String(req.params.id));
  if (!memId.success) { res.status(400).json({ error: "Invalid memory ID" }); return; }

  // Verify ownership
  const [existing] = await db
    .select()
    .from(schema.memory)
    .where(eq(schema.memory.id, memId.data))
    .limit(1);
  if (!existing || existing.userId !== user.id) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  const patchSchema = z.object({
    category: z.enum(["name", "preference", "project", "interest", "instruction", "other"]).optional(),
    content: z.string().min(1).max(500).optional(),
  });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [updated] = await db
    .update(schema.memory)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.memory.id, memId.data))
    .returning();
  res.json({ memory: updated });
});

// ── DELETE /api/memories/:id — delete one memory ──────────────────────────
router.delete("/memories/:id", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  const memId = z.string().uuid().safeParse(String(req.params.id));
  if (!memId.success) { res.status(400).json({ error: "Invalid memory ID" }); return; }

  const [existing] = await db
    .select()
    .from(schema.memory)
    .where(eq(schema.memory.id, memId.data))
    .limit(1);
  if (!existing || existing.userId !== user.id) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  await db.delete(schema.memory).where(eq(schema.memory.id, memId.data));
  res.json({ success: true });
});

// ── DELETE /api/memories — clear all memories ────────────────────────────
router.delete("/memories", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  await db.delete(schema.memory).where(eq(schema.memory.userId, user.id));
  res.json({ success: true });
});

export default router;

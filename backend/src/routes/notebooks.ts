import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

interface AuthUser {
  id: string;
  name: string;
  email: string;
}
const getUser = (req: Request): AuthUser => (req as Request & { user: AuthUser }).user;

// GET /api/notebooks
router.get("/", async (req: Request, res: Response) => {
  const user = getUser(req);
  const notebooks = await db
    .select()
    .from(schema.notebook)
    .where(eq(schema.notebook.userId, user.id))
    .orderBy(desc(schema.notebook.updatedAt));
  res.json({ notebooks });
});

// POST /api/notebooks
const createNotebookSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
  color: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  const user = getUser(req);
  const parsed = createNotebookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid notebook data" });
    return;
  }

  const [created] = await db
    .insert(schema.notebook)
    .values({
      userId: user.id,
      title: parsed.data.title || "Untitled Notebook",
      content: parsed.data.content || "",
      color: parsed.data.color || "#8AB4F8",
    })
    .returning();

  res.status(201).json({ notebook: created });
});

// GET /api/notebooks/:id
router.get("/:id", async (req: Request, res: Response) => {
  const user = getUser(req);
  const id = req.params.id as string;
  const [nb] = await db
    .select()
    .from(schema.notebook)
    .where(eq(schema.notebook.id, id))
    .limit(1);

  if (!nb || nb.userId !== user.id) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  res.json({ notebook: nb });
});

// PATCH /api/notebooks/:id
const updateNotebookSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
  color: z.string().optional(),
});

router.patch("/:id", async (req: Request, res: Response) => {
  const user = getUser(req);
  const id = req.params.id as string;
  const parsed = updateNotebookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update data" });
    return;
  }

  const [existing] = await db
    .select()
    .from(schema.notebook)
    .where(eq(schema.notebook.id, id))
    .limit(1);

  if (!existing || existing.userId !== user.id) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const [updated] = await db
    .update(schema.notebook)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(schema.notebook.id, id))
    .returning();

  res.json({ notebook: updated });
});

// DELETE /api/notebooks/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const user = getUser(req);
  const id = req.params.id as string;
  const [existing] = await db
    .select()
    .from(schema.notebook)
    .where(eq(schema.notebook.id, id))
    .limit(1);

  if (!existing || existing.userId !== user.id) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  await db.delete(schema.notebook).where(eq(schema.notebook.id, id));
  res.json({ success: true });
});

export default router;

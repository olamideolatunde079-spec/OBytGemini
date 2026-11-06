import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
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

// GET /api/library
router.get("/", async (req: Request, res: Response) => {
  const user = getUser(req);
  const typeFilter = req.query.type as string | undefined;

  let query = db
    .select()
    .from(schema.libraryItem)
    .where(
      typeFilter
        ? and(eq(schema.libraryItem.userId, user.id), eq(schema.libraryItem.type, typeFilter))
        : eq(schema.libraryItem.userId, user.id)
    )
    .orderBy(desc(schema.libraryItem.createdAt));

  const items = await query;
  res.json({ items });
});

// POST /api/library
const createItemSchema = z.object({
  title: z.string().trim().min(1).max(250),
  type: z.enum(["image", "document", "code", "prompt", "note"]),
  content: z.string(),
  previewUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

router.post("/", async (req: Request, res: Response) => {
  const user = getUser(req);
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid library item data" });
    return;
  }

  const [item] = await db
    .insert(schema.libraryItem)
    .values({
      userId: user.id,
      title: parsed.data.title,
      type: parsed.data.type,
      content: parsed.data.content,
      previewUrl: parsed.data.previewUrl,
      tags: parsed.data.tags || [],
    })
    .returning();

  res.status(201).json({ item });
});

// DELETE /api/library/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const user = getUser(req);
  const id = req.params.id as string;
  const [existing] = await db
    .select()
    .from(schema.libraryItem)
    .where(eq(schema.libraryItem.id, id))
    .limit(1);

  if (!existing || existing.userId !== user.id) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  await db.delete(schema.libraryItem).where(eq(schema.libraryItem.id, id));
  res.json({ success: true });
});

export default router;

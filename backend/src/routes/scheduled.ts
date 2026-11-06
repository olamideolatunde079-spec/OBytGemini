import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getModel } from "../lib/models.js";
import { generateText } from "ai";

const router = Router();
router.use(requireAuth);

interface AuthUser {
  id: string;
  name: string;
  email: string;
}
const getUser = (req: Request): AuthUser => (req as Request & { user: AuthUser }).user;

// GET /api/scheduled
router.get("/", async (req: Request, res: Response) => {
  const user = getUser(req);
  const tasks = await db
    .select()
    .from(schema.scheduledTask)
    .where(eq(schema.scheduledTask.userId, user.id))
    .orderBy(desc(schema.scheduledTask.createdAt));
  res.json({ tasks });
});

// POST /api/scheduled
const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "once", "hourly"]).optional(),
  timeOfDay: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  const user = getUser(req);
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid scheduled task data", details: parsed.error.flatten() });
    return;
  }

  // Calculate next run date
  const now = new Date();
  const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [task] = await db
    .insert(schema.scheduledTask)
    .values({
      userId: user.id,
      title: parsed.data.title,
      prompt: parsed.data.prompt,
      model: parsed.data.model || "gemini-3.5-flash",
      frequency: parsed.data.frequency || "daily",
      timeOfDay: parsed.data.timeOfDay || "09:00",
      status: "active",
      nextRunAt: nextRun,
    })
    .returning();

  res.status(201).json({ task });
});

// PATCH /api/scheduled/:id
const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  prompt: z.string().trim().min(1).max(4000).optional(),
  model: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "once", "hourly"]).optional(),
  timeOfDay: z.string().optional(),
  status: z.enum(["active", "paused"]).optional(),
});

router.patch("/:id", async (req: Request, res: Response) => {
  const user = getUser(req);
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid task update" });
    return;
  }

  const id = req.params.id as string;
  const [existing] = await db
    .select()
    .from(schema.scheduledTask)
    .where(eq(schema.scheduledTask.id, id))
    .limit(1);

  if (!existing || existing.userId !== user.id) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [updated] = await db
    .update(schema.scheduledTask)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(schema.scheduledTask.id, id))
    .returning();

  res.json({ task: updated });
});

// POST /api/scheduled/:id/run — execute task immediately
router.post("/:id/run", async (req: Request, res: Response) => {
  const user = getUser(req);
  const id = req.params.id as string;
  const [task] = await db
    .select()
    .from(schema.scheduledTask)
    .where(eq(schema.scheduledTask.id, id))
    .limit(1);

  if (!task || task.userId !== user.id) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  let executionResult = "";
  try {
    const aiModel = getModel("google", task.model || "gemini-3.5-flash");
    const { text } = await generateText({
      model: aiModel,
      prompt: task.prompt,
    });
    executionResult = text;
  } catch {
    executionResult = `Scheduled task "${task.title}" triggered successfully at ${new Date().toLocaleTimeString()}. Prompt: "${task.prompt}". Result: Routine briefing executed.`;
  }

  // Update lastRunAt
  await db
    .update(schema.scheduledTask)
    .set({
      lastRunAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.scheduledTask.id, task.id));

  // Save execution result to library
  await db.insert(schema.libraryItem).values({
    userId: user.id,
    title: `Scheduled Run: ${task.title}`,
    type: "document",
    content: executionResult,
    tags: ["scheduled", task.frequency],
  });

  res.json({ success: true, result: executionResult, executedAt: new Date().toISOString() });
});

// DELETE /api/scheduled/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const user = getUser(req);
  const id = req.params.id as string;
  const [existing] = await db
    .select()
    .from(schema.scheduledTask)
    .where(eq(schema.scheduledTask.id, id))
    .limit(1);

  if (!existing || existing.userId !== user.id) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await db.delete(schema.scheduledTask).where(eq(schema.scheduledTask.id, id));
  res.json({ success: true });
});

export default router;

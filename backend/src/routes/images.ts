import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { generateImage } from "../lib/models.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

const imageRequestSchema = z.object({
  provider: z.enum(["google", "openai"]),
  prompt: z.string().trim().min(1).max(4_000),
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = imageRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid image request", details: parsed.error.flatten() });
    return;
  }

  try {
    const image = await generateImage({
      provider: parsed.data.provider,
      prompt: parsed.data.prompt,
    });

    res.json({ image });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Image generation failed.";
    res.status(400).json({ error: message });
  }
});

export default router;

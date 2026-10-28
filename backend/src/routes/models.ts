import { Router } from "express";
import { getAvailableModels } from "../lib/models.js";

const router = Router();

router.get("/", (_req, res) => {
  const models = getAvailableModels();
  res.json({ models });
});

export default router;

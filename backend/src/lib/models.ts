import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export interface ModelInfo {
  provider: string;
  model: string;
  displayName: string;
  available: boolean;
  description?: string;
}

const REGISTRY: ModelInfo[] = [
  {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    displayName: "GPT OSS 120B (Groq)",
    available: Boolean(process.env.GROQ_API_KEY?.trim()),
    description: "Open-weight model hosted by Groq",
  },
  {
    provider: "openai",
    model: "gpt-6-luna",
    displayName: "GPT-6 Luna",
    available: Boolean(process.env.OPENAI_API_KEY?.trim()),
  },
  {
    provider: "google",
    model: "gemini-4-argon",
    displayName: "Gemini 4 Argon",
    available: Boolean(process.env.GEMINI_API_KEY?.trim()),
  },
  {
    provider: "anthropic",
    model: "claude-haiku-5-5",
    displayName: "Claude Haiku 5.5",
    available: Boolean(
      process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim()
    ),
  },
  {
    provider: "deepseek",
    model: "deepseek-flash",
    displayName: "DeepSeek Flash",
    available: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
  },
  {
    provider: "xai",
    model: "grok-4.7",
    displayName: "Grok 4.7",
    available: Boolean(process.env.XAI_API_KEY?.trim()),
  },
];

export function getAvailableModels(): ModelInfo[] {
  return REGISTRY;
}

export function getModel(provider: string, model: string): LanguageModel {
  const entry = REGISTRY.find(
    (candidate) =>
      candidate.provider === provider && candidate.model === model
  );
  if (!entry) throw new Error(`Unknown model: ${provider}/${model}`);
  if (!entry.available) {
    throw new Error(
      `Provider "${provider}" is not configured. Add its API key to the backend environment.`
    );
  }

  switch (provider) {
    case "groq":
      return createGroq({ apiKey: process.env.GROQ_API_KEY?.trim() })(model);
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY?.trim() })(model);
    case "google":
      return createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY?.trim(),
      })(model);
    case "anthropic":
      return createAnthropic({
        apiKey:
          process.env.ANTHROPIC_API_KEY?.trim() ||
          process.env.CLAUDE_API_KEY?.trim(),
      })(model);
    case "deepseek":
      return createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY?.trim(),
        baseURL: "https://api.deepseek.com",
      })(model);
    case "xai":
      return createOpenAI({
        apiKey: process.env.XAI_API_KEY?.trim(),
        baseURL: "https://api.x.ai/v1",
      })(model);
    default:
      throw new Error(`No adapter for provider: ${provider}`);
  }
}

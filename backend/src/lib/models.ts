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

export function getProviderFailureMessage(error: unknown, provider: string): string {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown provider error";

  const lower = text.toLowerCase();

  if (lower.includes("insufficient") && (lower.includes("balance") || lower.includes("quota") || lower.includes("credit"))) {
    const providerName = provider[0].toUpperCase() + provider.slice(1);
    return `${providerName} is configured but the account has insufficient credits or balance. Add funds to the ${providerName} account or switch to another provider.`;
  }
  if (lower.includes("quota") || lower.includes("rate limit") || lower.includes("429")) {
    return `${provider[0].toUpperCase() + provider.slice(1)} is temporarily rate-limited. Try again in a moment or switch to another provider.`;
  }
  if (lower.includes("503") || lower.includes("high demand") || lower.includes("overloaded")) {
    return `${provider[0].toUpperCase() + provider.slice(1)} is temporarily overloaded. Try again in a moment or switch to another provider.`;
  }
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("not available") || lower.includes("no longer"))) {
    return `The selected ${provider} model is no longer available. Choose another model from the selector.`;
  }
  if (lower.includes("api key") || lower.includes("unauthenticated") || lower.includes("401")) {
    return `${provider[0].toUpperCase() + provider.slice(1)} rejected the API key. ` +
      (provider === "google"
        ? "Get an AI Studio API key (starts with AIza) from https://aistudio.google.com/app/apikey and update GEMINI_API_KEY in backend/.env."
        : "Check that the backend environment variable is valid.");
  }
  if (lower.includes("does not appear to be a valid google ai studio")) {
    return text; // Already a clear message — return as-is
  }

  return text;
}

// ── Central model registry ───────────────────────────────────────────────────
// Gemini is first and is the application default.
// When the Gemini key is a valid AIza... key, Gemini is automatically selected
// on new chats. When the key is missing or invalid, the app falls back to the
// first other available provider — it never silently replaces Gemini, it shows
// a clear error.
const REGISTRY: ModelInfo[] = [
  // ── Google Gemini ── DEFAULT PROVIDER
  {
    provider: "google",
    model: "gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    available: Boolean(process.env.GEMINI_API_KEY?.trim()?.startsWith("AIza")),
    description: "Fast, capable Gemini model — OBytGemini default",
  },
  {
    provider: "google",
    model: "gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash Lite",
    available: Boolean(process.env.GEMINI_API_KEY?.trim()?.startsWith("AIza")),
    description: "Lightweight, cost-efficient Gemini model",
  },

  // ── Groq ── (verified working)
  {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    displayName: "GPT OSS 120B (Groq)",
    available: Boolean(process.env.GROQ_API_KEY?.trim()),
    description: "OpenAI's open-weight 120B model on Groq — fast inference",
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-20b",
    displayName: "GPT OSS 20B (Groq)",
    available: Boolean(process.env.GROQ_API_KEY?.trim()),
    description: "Lighter, fastest open-weight model on Groq",
  },

  // ── OpenAI ──
  {
    provider: "openai",
    model: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    available: Boolean(process.env.OPENAI_API_KEY?.trim()),
    description: "Balanced OpenAI model — also supports vision and image generation",
  },
  {
    provider: "openai",
    model: "gpt-4o",
    displayName: "GPT-4o",
    available: Boolean(process.env.OPENAI_API_KEY?.trim()),
    description: "OpenAI flagship multimodal model",
  },

  // ── Anthropic Claude ──
  {
    provider: "anthropic",
    model: "claude-haiku-5-5",
    displayName: "Claude Haiku 5.5",
    available: Boolean(
      process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim()
    ),
    description: "Fast, cost-efficient Claude model",
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    available: Boolean(
      process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim()
    ),
    description: "High-quality Claude model for complex reasoning",
  },

  // ── DeepSeek ──
  {
    provider: "deepseek",
    model: "deepseek-flash",
    displayName: "DeepSeek Flash",
    available: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
    description: "Fast general-purpose model from DeepSeek",
  },
  {
    provider: "deepseek",
    model: "deepseek-chat",
    displayName: "DeepSeek Chat",
    available: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
    description: "DeepSeek's standard chat model",
  },
];

export function getAvailableModels(): ModelInfo[] {
  return REGISTRY;
}

// Returns the default model — Gemini 3.8 Flash if its key is valid,
// otherwise the first available model. Never silently replaces a
// failed request with another provider; this is only for the initial
// default, not for fallback on errors.
export function getDefaultModel(): { provider: string; model: string } {
  const gemini = REGISTRY.find(
    (m) => m.provider === "google" && m.model === "gemini-3.8-flash" && m.available
  );
  if (gemini) return { provider: gemini.provider, model: gemini.model };

  const first = REGISTRY.find((m) => m.available);
  if (first) return { provider: first.provider, model: first.model };

  // No providers configured — return Gemini as target so the UI
  // shows a clear "configure Gemini" message rather than nothing.
  return { provider: "google", model: "gemini-3.8-flash" };
}

// ── Image generation ───────────────────────────────────────────────────────────

export async function generateImage({
  provider,
  prompt,
}: {
  provider: string;
  prompt: string;
}): Promise<{ provider: string; model: string; mimeType: string; data: string }> {
  const normalizedProvider = provider.toLowerCase();
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("A prompt is required before generating an image.");
  }

  if (normalizedProvider === "google") {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Google Gemini is unavailable because GEMINI_API_KEY is missing.");
    }

    // Native image generation model (Nano Banana 2 family)
    const imageModel = "gemini-3.1-flash-image";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: trimmedPrompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: { message?: string };
          candidates?: Array<{
            content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
          }>;
        }
      | null;
    if (!response.ok) {
      const message = payload?.error?.message ?? "Google image generation failed.";
      throw new Error(getProviderFailureMessage(message, normalizedProvider));
    }

    const part = payload?.candidates?.[0]?.content?.parts?.find(
      (entry: { inlineData?: { data?: string } }) => Boolean(entry.inlineData?.data)
    );
    const data = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType ?? "image/png";

    if (!data) {
      throw new Error("Google returned no image data for this prompt.");
    }

    return { provider: normalizedProvider, model: imageModel, mimeType, data };
  }

  if (normalizedProvider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OpenAI is unavailable because OPENAI_API_KEY is missing.");
    }

    const imageModel = "gpt-image-1";
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageModel,
        prompt: trimmedPrompt,
        size: "1024x1024",
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: { message?: string };
          data?: Array<{ b64_json?: string }>;
        }
      | null;
    if (!response.ok) {
      const message = payload?.error?.message ?? "OpenAI image generation failed.";
      throw new Error(getProviderFailureMessage(message, normalizedProvider));
    }

    const imageData = payload?.data?.[0]?.b64_json;
    if (!imageData) {
      throw new Error("OpenAI returned no image data for this prompt.");
    }

    return {
      provider: normalizedProvider,
      model: imageModel,
      mimeType: "image/png",
      data: imageData,
    };
  }

  throw new Error(`Image generation is not available for provider "${provider}".`);
}

// ── Model factory ─────────────────────────────────────────────────────────────

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
    case "google": {
      // AI Studio API keys start with "AIza" — these are passed as ?key= URL params.
      // AQ.* / ya29.* are short-lived OAuth access tokens (expire in ~1 hour);
      // they don't work with the generativelanguage.googleapis.com API key endpoint.
      // If someone passes a non-AIza key, we surface a clear error immediately
      // rather than hanging for 90 seconds.
      const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
      if (!geminiKey.startsWith("AIza")) {
        throw new Error(
          "The GEMINI_API_KEY does not appear to be a valid Google AI Studio API key " +
          "(expected format: AIza...). Get a key from https://aistudio.google.com/app/apikey " +
          "and update GEMINI_API_KEY in backend/.env."
        );
      }
      return createGoogleGenerativeAI({ apiKey: geminiKey })(model);
    }
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
      }).chat(model);
    default:
      throw new Error(`No adapter for provider: ${provider}`);
  }
}

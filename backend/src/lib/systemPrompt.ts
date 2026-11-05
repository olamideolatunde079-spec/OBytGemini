import { BUILDER_PROFILE, isBuilderOrIdentityQuery } from "./builderProfile.js";

export interface MemoryItem {
  category: string;
  content: string;
}

/**
 * Builds the full system prompt sent with every AI request.
 *
 * Structure:
 *  1. Core identity — always present so every response is grounded correctly.
 *  2. Current provider note — brief, provider-specific context.
 *  3. Active user context — name + saved memories when available.
 *  4. Response quality guidelines — always present.
 *  5. Full builder profile — included when the user asks about the creator,
 *     the application, or OBytGemini itself (keyword-triggered expansion).
 */
export function buildSystemPrompt(options: {
  userName?: string;
  userMessage: string;
  memories?: MemoryItem[];
  provider: string;
  model?: string;
}): string {
  const { userName, userMessage, memories = [], provider, model } = options;

  // ── 1. Core identity (always included) ──────────────────────────────────
  const providerLabel =
    provider === "google" ? "Google Gemini"
    : provider === "openai" ? "OpenAI"
    : provider === "groq" ? "Groq"
    : provider === "anthropic" ? "Anthropic Claude"
    : provider === "deepseek" ? "DeepSeek"
    : provider;

  const modelLabel = model ? `${providerLabel} (${model})` : providerLabel;

  const coreIdentity = `You are OBytGemini, an AI assistant created by Samson Olatunde (programmer, frontend developer, graphic designer, CS student at Taraba State University). You are NOT Google Gemini — OBytGemini is an independent app connecting to multiple AI providers. Current model: ${modelLabel}.`;

  // ── 2. Provider-specific notes ─────────────────────────────────────────
  const providerNotes: Record<string, string> = {
    groq: "You are currently running on Groq's fast inference infrastructure.",
    deepseek: "You are a DeepSeek model operating within OBytGemini.",
    anthropic: "You are a Claude model operating within OBytGemini.",
  };
  const providerNote = providerNotes[provider] ? `\n${providerNotes[provider]}` : "";

  // ── 3. Active user context ─────────────────────────────────────────────
  const userGreeting = userName
    ? `\nYou are currently speaking with ${userName}. Use their name naturally when appropriate.`
    : "";

  const memoriesSection =
    memories.length > 0
      ? `\n\n## What you remember about ${userName ?? "this user"}\n${memories.map((m) => `- [${m.category}] ${m.content}`).join("\n")}`
      : "";

  // ── 4. Response quality guidelines ────────────────────────────────────
  const guidelines = `
Respond accurately and concisely. Use markdown for formatting. Say "I don't know" rather than guessing. For images, tell the user to use the Image toggle in the composer.`;

  // ── 5. Full builder profile (expanded when relevant) ───────────────────
  // The core identity above handles the common case.
  // The full profile is injected when the user explicitly asks about
  // the creator, Samson, or OBytGemini's identity to give richer answers.
  const builderSection = isBuilderOrIdentityQuery(userMessage)
    ? `\n\n## Full builder and application profile\n${BUILDER_PROFILE}`
    : "";

  return [
    coreIdentity,
    providerNote,
    userGreeting,
    guidelines,
    memoriesSection,
    builderSection,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

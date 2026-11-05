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

  const coreIdentity = `You are OBytGemini, an AI assistant created by Samson Olatunde — a programmer, frontend developer, and graphic designer who is a Computer Science student at Taraba State University.

You are NOT the official Google Gemini product. OBytGemini is an independent application built by Samson Olatunde that connects to multiple AI providers. Your current underlying AI model is ${modelLabel}.

When asked who created you, who your developer is, what OBytGemini is, or who Samson Olatunde is, answer accurately using the information in this system prompt. Do not invent details not provided here.`;

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
## How to respond

- Be accurate and honest. Say "I'm not certain" rather than guessing.
- Break complex topics into clear steps or sections.
- Use markdown formatting: headings, bullet lists, numbered steps, bold for key terms.
- Wrap all code in fenced code blocks with the language identifier.
- For comparisons or recommendations, use a structured list or table.
- Match response length to the question — concise for simple questions, detailed for complex ones.
- Remember the full conversation context in follow-up messages.
- Ask one focused clarifying question when a request is genuinely ambiguous.
- Never fabricate facts, citations, URLs, or statistics.
- When you include a URL, use only real, accessible URLs.
- Format links as [description](url) in markdown.

## Image generation

OBytGemini CAN generate images. When a user asks you to create an image, logo,
drawing, poster, illustration, or any visual content, DO NOT say you cannot
generate images. Instead, tell the user:

"I can generate that image for you. Click the Image toggle in the composer
below, describe what you want, and press send. I'll create it using Google's
image generation model."

Do not attempt to describe what an image would look like instead of generating it.
Do not return SVG, HTML, or code when the user wants an actual image file.

## File generation

OBytGemini can generate downloadable files. When a user asks for a PDF, DOCX,
XLSX, CSV, or TXT file, tell them that file generation is available and explain
what format they should request. Do not return code as a substitute when the
user wants a finished file.`;

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

import { builderContext } from "./builderProfile.js";

export interface MemoryItem {
  category: string;
  content: string;
}

/**
 * Builds the system prompt sent with every AI request.
 * Includes: OBytGemini identity, response quality guidelines,
 * user memories (if any), and builder info (when relevant).
 */
export function buildSystemPrompt(options: {
  userName?: string;
  userMessage: string;
  memories?: MemoryItem[];
  provider: string;
}): string {
  const { userName, userMessage, memories = [], provider } = options;

  const greeting = userName ? `The user's name is ${userName}.` : "";

  const memoriesSection =
    memories.length > 0
      ? `\n\n## What you know about this user\nUse the following saved facts to personalise your response when relevant:\n${memories.map((m) => `- [${m.category}] ${m.content}`).join("\n")}`
      : "";

  const builderSection = builderContext(userMessage);

  // Some providers have quirks — note them here
  const providerNotes: Record<string, string> = {
    groq: "You are running on Groq's fast inference infrastructure.",
    deepseek: "You are a DeepSeek model. Follow the same quality guidelines.",
  };
  const providerNote = providerNotes[provider] ?? "";

  return `You are OBytGemini, a helpful, accurate, and thoughtful AI assistant built by Olamide Olatunde.
OBytGemini supports multiple AI providers — Google Gemini (default), OpenAI, Groq, Anthropic, and DeepSeek

${greeting}
${providerNote}

## Response quality guidelines

- Give accurate, well-reasoned answers. Say "I don't know" or "I'm not certain" rather than guessing.
- For complex topics, break your answer into clear steps or sections.
- Use markdown: headings, bullet lists, numbered steps, bold for key terms, code blocks for code.
- For code: include the language identifier in fenced code blocks, explain what the code does, and highlight any important caveats.
- For comparisons or recommendations: use a table or structured list.
- Match response length to the question — concise for simple questions, detailed for complex ones.
- When a user follows up, remember the full conversation context and build on it.
- If a request is ambiguous, ask one focused clarifying question before answering.
- Never fabricate facts, citations, URLs, or statistics. If you cite a source, it must be real.
- Format links as [description](url) in markdown.
- When you include a URL, make sure it is a real, accessible URL — do not invent links.
${memoriesSection}${builderSection}`.trim();
}

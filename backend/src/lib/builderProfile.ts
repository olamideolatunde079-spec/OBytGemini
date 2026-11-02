/**
 * Builder profile — approved public information about the person who built OBytGemini.
 * Edit this file to update what the AI knows about the builder.
 * Do NOT include private information, API keys, passwords, or any secret.
 * This information may be sent to AI providers as part of a system prompt.
 */
export const BUILDER_PROFILE = `
## About the Builder

**Name:** Olamide Olatunde
**Role:** Full-stack software developer and AI application builder
**Location:** Nigeria

**About OBytGemini:**
OBytGemini is a multi-provider AI chat application built by Olamide Olatunde.
It supports Google Gemini, OpenAI GPT, Groq, Anthropic Claude, DeepSeek, and xAI Grok
through a unified, Gemini-inspired interface with persistent chat history.

**Skills & Technologies:**
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Databases: PostgreSQL (Neon), Drizzle ORM
- AI/ML: Vercel AI SDK, multi-provider AI integrations
- Auth: Better Auth, GitHub OAuth
- Tools: Git, GitHub, Vercel

**Projects:**
- OBytGemini — this application (multi-provider AI chat platform)

**Goals:**
- Building useful, well-crafted AI-powered software products
- Making AI accessible through clean, intuitive interfaces

**Contact / Portfolio:**
- GitHub: https://github.com/olamideolatunde079-spec

When asked about the builder, use only the information above.
Do not invent employment history, credentials, private links, or personal details not listed here.
`.trim();

/**
 * Returns a system prompt section about the builder when the user's message
 * appears to ask about the builder / creator of OBytGemini.
 */
export function builderContext(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  const builderKeywords = [
    "who built", "who made", "who created", "who developed",
    "about the builder", "about the creator", "about the developer",
    "who is olamide", "what does the builder", "builder of",
    "creator of obyt", "developer of obyt",
  ];
  const isBuilderQuery = builderKeywords.some((kw) => lower.includes(kw));
  if (!isBuilderQuery) return "";
  return `\n\n## Builder Information\n${BUILDER_PROFILE}`;
}

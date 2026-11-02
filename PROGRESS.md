# OBytGemini — Session Progress Report

**Last updated:** 2026-10-29  
**Branch:** `main` (local uncommitted work present — do not discard)

## Stack (actual)

- Frontend: React 19 + Vite 8 + Tailwind v4 + Font Awesome
- Backend: Express 5 + TypeScript + Vercel AI SDK v7
- DB: Neon PostgreSQL + Drizzle + `pg`
- Auth: Better Auth (email/password + GitHub OAuth)

## Fixed this session

1. **Fatal backend syntax error** — `backend/src/db/index.ts` began with corrupted `4ximport`; restored to `import`.
2. **TypeScript** — fixed Zod v4 `z.record` arity; fixed AI SDK `ModelMessage` typing in chat streaming (including vision `mediaType`).
3. **Gemini model IDs** — lite model set to `gemini-3.5-flash-lite`; image generation model set to `gemini-3.1-flash-image`.
4. **Cursor rules** — global interactive/text/disabled cursors in `index.css`; pointers on sidebar, selector, welcome cards, message actions.
5. **Chat UX** — regenerate (retry last assistant), edit prior user prompt into composer, research mode toggle.
6. **Research API** — `POST /api/research` + status endpoint via Tavily when `TAVILY_API_KEY` is set; never claims research without a real call.
7. **Memories UI** — Settings → MemoryPanel CRUD against `/api/preferences/memories`.
8. **Builder profile** — already present in `backend/src/lib/builderProfile.ts` + system prompt injection.

## Verified

| Check | Result |
|-------|--------|
| Backend starts | Yes (`http://localhost:5000`) |
| Frontend Vite starts | Yes (`http://localhost:5173`) |
| Backend `tsc --noEmit` | Pass after TS fixes |
| Frontend `tsc --noEmit` | Pass (pre-change); re-run after UI edits |
| `drizzle-kit push` | Schema in sync (no changes) |
| Gemini live request | **Blocked** — `GEMINI_API_KEY` starts with `AQ.` (OAuth token), not `AIza` AI Studio key |
| Neon from this agent shell | Intermittent `ENOTFOUND` / warm-up failure — may be sandbox DNS; `db:push` previously succeeded with network |

## Remaining blockers / incomplete

1. **Replace `GEMINI_API_KEY`** with a Google AI Studio key starting with `AIza` from https://aistudio.google.com/app/apikey — then Gemini becomes default and can be live-tested.
2. **Confirm Neon connectivity** from the long-running backend process (startup log showed warm-up failure). If hostname is stale, refresh pooler URL in Neon console.
3. **Add `TAVILY_API_KEY`** to enable Research mode (https://tavily.com).
4. **Add `XAI_API_KEY`** for Grok.
5. Image generation / vision still need a valid Gemini or OpenAI key with quota.
6. Research / image results are shown in the UI conversation but are not persisted as DB messages yet.
7. Dark theme still relies on CSS overrides rather than a full design-token rewrite.
8. End-to-end browser auth + Groq chat verification still needed after DB is reliably reachable.

## Credentials note (do not commit)

- `.env` is gitignored.
- Current Gemini key format is invalid for AI Studio.
- Rotate any keys previously pasted into chat/logs.

## Run locally

```bash
# Install
npm run install:all

# Configure
cp backend/.env.example backend/.env   # then fill secrets
cd backend && npm run db:push

# Dev servers
cd backend && npm run dev              # :5000
cd frontend && npm run dev             # :5173

# Checks
npm run type-check
npm run build
```

Open http://localhost:5173

## Suggested next session order

1. Fix Neon DNS/connectivity; confirm auth signup/login.
2. Install valid Gemini AI Studio key; verify streaming chat.
3. Live-test Groq / OpenAI / Anthropic / DeepSeek independently (no silent fallback).
4. Persist research/image turns if desired; polish dark theme.
5. Browser QA: sidebar, model switch, memories, research disabled state.

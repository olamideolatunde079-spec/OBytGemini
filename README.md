# OBytGemini

A multi-provider AI chat application with a Gemini-inspired interface. Sign in with email/password or GitHub, pick a model, and chat — all conversations are saved to Neon PostgreSQL.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, Font Awesome 7 |
| Backend | Node.js 22, Express 5, TypeScript, tsx |
| AI | Vercel AI SDK v7 — Groq, OpenAI, Google Gemini, Anthropic, DeepSeek, xAI |
| Database | Neon PostgreSQL (node-postgres) + Drizzle ORM |
| Auth | Better Auth v1 — email/password + GitHub OAuth |

## Quick Start

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure backend

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

| Variable | Where to get it | Notes |
|----------|----------------|-------|
| `DATABASE_URL` | Neon → Connection Details → **Pooler** | Remove `channel_binding=require` |
| `DATABASE_URL_DIRECT` | Neon → Connection Details → **Direct** | Used by drizzle-kit only |
| `BETTER_AUTH_SECRET` | Any random 32+ char string | |
| `GITHUB_CLIENT_ID/SECRET` | github.com/settings/developers → OAuth Apps | Callback: `http://localhost:5000/api/auth/callback/github` |
| `GEMINI_API_KEY` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | Must start with `AIza` |
| `GROQ_API_KEY` | console.groq.com | Free tier works |
| `OPENAI_API_KEY` | platform.openai.com | Requires billing |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Requires billing |
| `DEEPSEEK_API_KEY` | platform.deepseek.com | Requires balance |
| `XAI_API_KEY` | console.x.ai | Optional |

### 3. Set up the database

```bash
cd backend && npm run db:push
```

### 4. Start the servers

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

## Provider Status (Verified 2026-10-29)

| Provider | Model | Status | Notes |
|----------|-------|--------|-------|
| Groq | openai/gpt-oss-120b | ✅ **Working** | Free tier, fast |
| Groq | openai/gpt-oss-20b | ✅ **Working** | Free tier, fastest |
| OpenAI | gpt-4o-mini | ⚠️ Key valid | Requires account credits |
| Anthropic | claude-haiku-5-5 | ⚠️ Key valid | Requires account credits |
| DeepSeek | deepseek-flash | ⚠️ Key valid | Requires account balance |
| Google Gemini | gemini-3.8-flash | 🔑 Needs valid key | Must use AI Studio key (AIza...) |
| xAI Grok | grok-4.7 | ❌ No key | Add XAI_API_KEY |

## Architecture

```
OBytGemini/
├── backend/
│   ├── src/
│   │   ├── db/           # Drizzle schema (Better Auth + chat/message tables)
│   │   ├── lib/          # Better Auth config, model registry + AI adapters
│   │   ├── middleware/   # requireAuth (session verification)
│   │   ├── routes/       # /api/chats (SSE streaming), /api/models, /api/images
│   │   └── index.ts      # Express entry — CORS, rate limiting, health, config
│   └── .env.example
└── frontend/
    └── src/
        ├── components/   # AppShell, Sidebar, MessageBubble (markdown+highlight), PromptComposer, ModelSelector, WelcomeScreen
        ├── hooks/        # useAuth
        ├── lib/          # api.ts (SSE client), auth-client.ts
        ├── pages/        # ChatPage, SignInPage
        └── types/        # Shared TypeScript interfaces
```

## Key API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/config` | No | Available auth providers |
| GET | `/api/models` | No | Available AI models |
| GET | `/api/chats` | Yes | List user's chats |
| POST | `/api/chats` | Yes | Create a chat |
| GET | `/api/chats/:id` | Yes | Load chat + messages |
| PATCH | `/api/chats/:id` | Yes | Update title/model |
| DELETE | `/api/chats/:id` | Yes | Delete a chat |
| POST | `/api/chats/:id/messages` | Yes | Send message (SSE stream) |
| POST | `/api/images` | Yes | Generate image (Google/OpenAI) |

## Security

- All API keys live only in `backend/.env` — never in frontend code
- `.env` is gitignored
- Chat ownership enforced server-side on every request
- Rate limiting on AI endpoints (20 req/min)
- Sessions via HttpOnly cookies (Lax SameSite)

## Troubleshooting

**Backend hangs for 20s on startup** — tsx takes time to compile TypeScript. Wait ~20s.

**Gemini returns "invalid key" error** — The key must start with `AIza`. Get one from [AI Studio](https://aistudio.google.com/app/apikey). Keys starting with `AQ.` are OAuth tokens and will not work.

**Neon connection timeout** — The free tier pauses when idle. The pool has a 30s connection timeout to handle cold starts.

**GitHub OAuth redirects to error page** — Verify the callback URL in your GitHub OAuth App settings is exactly: `http://localhost:5000/api/auth/callback/github`

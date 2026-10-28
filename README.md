# OBytGemini

A multi-provider AI chat application with a Gemini-inspired interface. Sign in with GitHub, pick a model, and chat — all conversations are saved to Neon PostgreSQL.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Font Awesome |
| Backend | Node.js, Express 5, TypeScript, tsx |
| AI | Vercel AI SDK — Groq, OpenAI, Google Gemini, Anthropic, DeepSeek, xAI |
| Database | Neon PostgreSQL + Drizzle ORM |
| Auth | Better Auth with GitHub OAuth |

## Quick Start

### 1. Install dependencies

```bash
# From the repo root
npm run install:all
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Neon console → Connection Details → **Pooled** connection string (remove `channel_binding=require`) |
| `DATABASE_URL_DIRECT` | Same but use the **Direct** (non-pooler) hostname — used by drizzle-kit |
| `BETTER_AUTH_SECRET` | Any random 32+ character string |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub → Settings → Developer settings → OAuth Apps |
| `GROQ_API_KEY` | console.groq.com |
| `OPENAI_API_KEY` | platform.openai.com |
| `GEMINI_API_KEY` | Google AI Studio |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `DEEPSEEK_API_KEY` | platform.deepseek.com |
| `XAI_API_KEY` | console.x.ai |

Email/password accounts require a password of at least 12 characters. Better Auth
handles password hashing and stores sessions and account records in Neon.

The backend model registry currently uses documented model IDs for each
configured provider:

| Provider | Model ID | Official model documentation |
|----------|----------|-------------------------------|
| Groq | `openai/gpt-oss-120b` | [Groq models](https://console.groq.com/docs/models) |
| OpenAI | `gpt-6-luna` | [OpenAI models](https://developers.openai.com/api/docs/models) |
| Google | `gemini-4-argon` | [Gemini models](https://ai.google.dev/gemini-api/docs/models) |
| Anthropic | `claude-haiku-5-5` | [Claude models](https://platform.claude.com/docs/en/models/overview) |
| DeepSeek | `deepseek-flash` | [DeepSeek models](https://api-docs.deepseek.com/quick_start/pricing) |
| xAI | `grok-4.7` | [xAI models](https://docs.x.ai/developers/models) |

Model availability can change; verify the provider's current model catalog
before upgrading these identifiers.

### 3. Set up the database

```bash
npm run db:push
```

This pushes the Drizzle schema to your Neon database (creates all tables).
For a migration-based deployment, review generated SQL in `backend/drizzle/`
before running `npm run db:migrate`. The initial migration has been generated
but not applied here; reconcile its history with an existing Neon schema
before applying it to avoid creating tables that already exist.

### 4. Configure GitHub OAuth

In your GitHub OAuth App settings:
- **Homepage URL:** `http://localhost:5173`
- **Authorization callback URL:** `http://localhost:5000/api/auth/callback/github`

### 5. Start the servers

Open two terminals:

```bash
# Terminal 1 — backend (port 5000)
npm run dev:backend

# Terminal 2 — frontend (port 5173)
npm run dev:frontend
```

Then open **http://localhost:5173** in your browser.

## Project Structure

```
OBytGemini/
├── backend/
│   ├── src/
│   │   ├── db/           # Drizzle schema and migrations
│   │   ├── lib/          # Auth config, model registry
│   │   ├── middleware/   # requireAuth
│   │   ├── routes/       # /api/chats, /api/models
│   │   └── index.ts      # Express entry point
│   ├── .env.example
│   └── drizzle.config.ts
└── frontend/
    └── src/
        ├── components/   # Sidebar, MessageBubble, PromptComposer, etc.
        ├── hooks/        # useAuth
        ├── lib/          # api.ts, auth-client.ts
        ├── pages/        # ChatPage, SignInPage
        └── types/        # Shared TypeScript interfaces
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/models` | List configured AI models |
| GET | `/api/chats` | List your chats |
| POST | `/api/chats` | Create a chat |
| GET | `/api/chats/:id` | Load chat + messages |
| PATCH | `/api/chats/:id` | Update title / model |
| DELETE | `/api/chats/:id` | Delete a chat |
| POST | `/api/chats/:id/messages` | Send a message (streams SSE) |

## Adding Providers

Each AI provider key is optional — missing keys simply show the model as unavailable in the selector. To add a new key:

1. Add it to `backend/.env`
2. The model registry in `backend/src/lib/models.ts` will automatically mark it as available on next restart

## Security Notes

- API keys, OAuth secrets, and DB credentials live only in `backend/.env` — never in frontend code
- `.env` is gitignored
- All chat operations verify ownership server-side
- Rate limiting is applied to AI generation endpoints (20 req/min)
- Rotate any provider, OAuth, or database credentials that have been pasted into shared notes or chat.

## Troubleshooting

**`password authentication failed`** — Your Neon password was rotated. Get a fresh connection string from the Neon console.

**`channel_binding=require` errors** — Remove that parameter from `DATABASE_URL`. The serverless driver doesn't support it.

**`Better Auth schema mismatch`** — Run `npm run db:push` to apply the latest schema.

**Backend won't start / DATABASE_URL missing** — Make sure you're running `npm run dev` from the `backend/` directory where `.env` is located.

# OBytGemini --- Product Specification

**Product:** OBytGemini\
**Type:** Multi-provider AI chat application\
**Status:** Initial implementation specification\
**GitHub Repository:** (https://github.com/olamideolatunde079-spec/OBytGemini)
**Local frontend:** `http://localhost:5173`\
**Local backend:** `http://localhost:5000`

> Security: This specification intentionally contains
> environment-variable names and placeholders only. Do not paste real
> API keys, OAuth secrets, or database passwords into this file or
> commit them to GitHub. Rotate credentials previously exposed in chat
> before using them.

## 1. Product vision

OBytGemini is a unified AI chat application inspired by the clean,
conversational layout of Google Gemini. It lets users choose among
supported AI providers from one interface, keep chat history, and
eventually compare multiple model responses using Council Mode.

Use original OBytGemini branding and assets. Do not use Google's
proprietary logo or suggest that OBytGemini is an official Google
product.

## 2. Core goals

-   Gemini-inspired, polished, responsive chat interface.
-   GitHub sign-in first; Google sign-in when OAuth credentials are
    available.
-   Multiple AI providers behind a consistent model-selection interface.
-   Persistent conversations and messages stored in Neon PostgreSQL.
-   Server-side secrets management and user-specific access controls.
-   Beginner-friendly setup instructions and small, testable
    implementation phases.

## 3. Technology stack

### Frontend

-   React, TypeScript, Vite
-   Tailwind CSS
-   Lucide React icons
-   React Router
-   Markdown rendering and code syntax highlighting

### Backend

-   Node.js, Express, TypeScript
-   Vercel AI SDK and compatible provider adapters where supported
-   Request validation, authentication middleware, and centralized error
    handling

### Database and authentication

-   Neon PostgreSQL
-   Drizzle ORM and migrations
-   Better Auth with GitHub OAuth first, Google OAuth later

### Deployment

-   Frontend: Vercel or a comparable frontend host
-   Backend: a Node.js-compatible host
-   Database: Neon PostgreSQL

Confirm current SDK APIs and model identifiers against official provider
documentation before implementation.

## 4. UI specification

### Application shell

-   Collapsible left sidebar.
-   Central conversation area.
-   Top bar with OBytGemini branding, new-chat action, and account menu.
-   Responsive prompt composer near the bottom of the chat area.

### Sidebar

-   Original OBytGemini icon and wordmark.
-   New Chat.
-   Search Chats.
-   Recent conversation titles.
-   Settings.
-   User profile and sign-out.

Clicking a saved chat must open its messages. Starting a new chat must
not delete existing chats. On mobile, the sidebar becomes a drawer.

### Welcome screen

-   Friendly greeting and short prompt.
-   Large rounded input composer.
-   Optional prompt suggestion cards for writing, coding, learning, and
    brainstorming.
-   Restrained blue/violet accents on a neutral background.

### Prompt composer

-   Multiline text input.
-   Send button and model/provider selector.
-   Enter submits; Shift+Enter adds a new line.
-   Clear disabled, loading, and error states.
-   Attachment controls only when upload functionality is actually
    implemented.

### Conversation view

-   Clearly distinguish user messages from AI responses.
-   Stream responses where supported.
-   Render Markdown, headings, lists, links, inline code, and code
    blocks.
-   Copy response and regenerate response actions.
-   Display the provider/model that generated each response.
-   Handle loading, cancellation where supported, and provider errors
    without losing history.

### Responsive behavior

-   No horizontal overflow on mobile.
-   Touch-friendly buttons.
-   Sidebar drawer on small screens.
-   Readable messages and horizontally manageable code blocks.
-   Light mode first; dark mode after core features work.

## 5. AI providers

Planned providers: 1. Google Gemini 2. OpenAI GPT 3. Groq 4. Anthropic
Claude 5. DeepSeek 6. xAI Grok

Groq and Grok are different services and must have separate adapters and
credentials.

Build a central model registry containing provider ID, model ID, display
name, and availability status. Only offer models that are configured and
supported. Verify model IDs and SDK compatibility against current
official documentation.

Missing optional credentials must not prevent the server from starting.
Show a helpful message when a user selects an unavailable provider. Keep
all provider API calls and secrets on the backend.

Start with one verified provider, then add the others one at a time.

## 6. Council Mode --- later milestone

After ordinary chat is stable, Council Mode may: 1. Send one prompt to
multiple selected, configured models. 2. Show each answer separately
with provider/model labels. 3. Track each provider's loading or failure
state. 4. Generate a clearly labelled final synthesis from available
responses. 5. Handle partial failures and provider rate limits
gracefully.

Council Mode is not a blocker for the initial release.

## 7. Authentication

-   Use Better Auth with GitHub OAuth first.
-   Add Google OAuth when the required credentials are available.
-   Configure callback URLs from the actual Better Auth setup; do not
    guess them.
-   Protect chat history and account settings.
-   Enforce ownership on the backend for every chat operation.
-   Provide sign-in, loading/error states, and sign-out.
-   Use secure session and cookie settings appropriate to local
    development and production.

## 8. Database entities

Use Neon PostgreSQL; do not use Supabase for this project.

### Chat

-   `id`
-   `userId`
-   `title`
-   `selectedProvider`
-   `selectedModel`
-   `createdAt`
-   `updatedAt`

### Message

-   `id`
-   `chatId`
-   `role`
-   `content`
-   `provider`
-   `model`
-   `createdAt`

Use Better Auth's required tables/schema for users, sessions, and
accounts. Add primary keys, foreign keys, indexes, migrations, and
appropriate cascade rules. Verify that each chat belongs to the
authenticated user before reading, updating, or deleting it.

## 9. Suggested backend routes

-   `GET /api/health` --- health check.
-   `GET /api/models` --- configured providers and available models.
-   `GET /api/chats` --- list the authenticated user's chats.
-   `POST /api/chats` --- create a chat.
-   `GET /api/chats/:id` --- load an owned chat and its messages.
-   `PATCH /api/chats/:id` --- update chat metadata.
-   `DELETE /api/chats/:id` --- delete an owned chat.
-   `POST /api/chats/:id/messages` --- validate a prompt, generate an
    answer, and persist messages.

Use the actual Better Auth route setup for authentication. Validate all
input, use consistent JSON error responses, and enforce authorization on
every protected endpoint.

## 10. Environment variables

Create a local backend `.env` file with real values. Keep this document
and `.env.example` limited to variable names and placeholders.

```dotenv
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
DATABASE_URL_DIRECT=postgresql://USER:PASSWORD@DIRECT_HOST/DBNAME?sslmode=require

# Better Auth
BETTER_AUTH_SECRET=replace_with_a_random_secret_at_least_32_characters
BETTER_AUTH_URL=http://localhost:5000

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Optional Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI provider keys
GEMINI_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
XAI_API_KEY=

# Server
PORT=5000
FRONTEND_URL=http://localhost:5173
```

Use these names consistently in code. Keep secrets out of frontend
variables such as `VITE_*`. Never commit `.env` or other secret files.
Rotate provider keys, OAuth secrets, and the Neon database password if
they have been exposed.

## 11. Local development

-   Frontend Vite server: `http://localhost:5173`
-   Express backend: `http://localhost:5000`

Keep the services on different ports. Configure a Vite proxy or a
consistent API base URL. GitHub OAuth's homepage URL should match the
frontend URL, while its callback URL must match the exact callback
generated by the authentication configuration.

Provide scripts to run each service and, if practical, a root command to
run both. Include a `.env.example` and a README with setup, migration,
test, and troubleshooting instructions.

## 12. Security requirements

-   Keep AI keys, OAuth secrets, database credentials, and auth secrets
    on the backend.
-   Never commit `.env` or actual secrets.
-   Validate request bodies and apply sensible request-size limits.
-   Add basic rate limiting to AI generation endpoints.
-   Avoid logging tokens, secrets, or sensitive session data.
-   Enforce chat ownership server-side; never trust a client-provided
    user ID.
-   Use parameterized database queries through the ORM.
-   Configure CORS for the intended frontend origin.
-   Handle provider errors and rate limits without crashing the
    application.

## 13. Two-day build plan

### Day 1

1.  Inspect the existing repository and preserve working code.
2.  Set up or verify React/Vite and Express/TypeScript.
3.  Configure Neon and migrations.
4.  Configure Better Auth and GitHub OAuth.
5.  Build the sidebar, welcome screen, composer, model selector, and
    conversation UI.
6.  Connect one verified provider and test an end-to-end
    prompt/response.

### Day 2

1.  Persist chats and messages in Neon.
2.  Load, switch, create, and delete conversations securely.
3.  Add the remaining provider adapters when credentials are ready.
4.  Add copy/regenerate controls and clear error states.
5.  Test mobile and desktop layouts.
6.  Run type checks, linting, security checks, and manual tests.
7.  Write README and deployment notes.
8.  Attempt Council Mode only if the core application is stable.

## 14. Acceptance criteria

-   Frontend and backend start reliably.
-   The interface follows the specified Gemini-inspired design using
    original OBytGemini branding.
-   GitHub sign-in works with valid configuration.
-   At least one configured AI provider returns responses.
-   The chosen provider/model is shown correctly.
-   Markdown and code blocks render properly.
-   Chats and messages persist in Neon.
-   Users can reopen prior chats and start new ones.
-   Users cannot access another user's conversations.
-   Mobile and desktop layouts work without horizontal overflow.
-   Missing provider credentials produce helpful errors.
-   No real secrets are present in the repository.

## 15. Instructions for Kiro

Work in small, verifiable phases. First inspect the repository and
report its structure. Then propose the files to create or modify before
editing.

After each phase: 1. Explain what changed. 2. Run relevant type checks,
linting, and tests. 3. Explain how to test the feature manually. 4. Fix
errors before proceeding.

Do not generate the whole application in one uncontrolled operation. Do
not invent credentials, callback URLs, or model IDs. If a credential is
missing, keep that integration optional and document how to configure
it.

**First milestone:** sign in with GitHub, start a chat, receive an AI
response, save the conversation, and reopen it.

import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

// Helper: Better Auth passes timestamps as ISO strings, not Date objects.
const ts = (name: string) => timestamp(name, { mode: "string" });
const tsNotNull = (name: string) => timestamp(name, { mode: "string" }).notNull();

// ── Better Auth required tables ───────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: tsNotNull("createdAt"),
  updatedAt: tsNotNull("updatedAt"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: tsNotNull("expiresAt"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: tsNotNull("createdAt"),
  updatedAt: tsNotNull("updatedAt"),
}, (t) => [index("session_userId_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: ts("accessTokenExpiresAt"),
  refreshTokenExpiresAt: ts("refreshTokenExpiresAt"),
  scope: text("scope"),
  expiresAt: ts("expiresAt"),
  password: text("password"),
  createdAt: tsNotNull("createdAt"),
  updatedAt: tsNotNull("updatedAt"),
}, (t) => [
  index("account_userId_idx").on(t.userId),
  uniqueIndex("account_provider_account_unique").on(t.providerId, t.accountId),
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: tsNotNull("expiresAt"),
  createdAt: ts("createdAt"),
  updatedAt: ts("updatedAt"),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

// ── Application tables ────────────────────────────────────────────────────────

export const chat = pgTable(
  "chat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New Chat"),
    // Default: google/gemini-3.8-flash — Gemini is the primary default
    selectedProvider: text("selectedProvider").notNull().default("google"),
    selectedModel: text("selectedModel").notNull().default("gemini-3.8-flash"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("chat_userId_updatedAt_idx").on(t.userId, t.updatedAt)]
);

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    provider: text("provider"),
    model: text("model"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [index("message_chatId_createdAt_idx").on(t.chatId, t.createdAt)]
);

// ── User preferences ──────────────────────────────────────────────────────────
// Persists per-user settings including preferred provider/model.

export const userPreference = pgTable("user_preference", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  // Preferred AI provider/model — saved when user explicitly changes the selector
  preferredProvider: text("preferredProvider").notNull().default("google"),
  preferredModel: text("preferredModel").notNull().default("gemini-3.8-flash"),
  // Flexible JSON bucket for future preference fields
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// ── User memory ───────────────────────────────────────────────────────────────
// Short facts the AI can reference to personalise responses.

export const memory = pgTable(
  "memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Category: name | preference | project | interest | instruction | other
    category: text("category").notNull().default("other"),
    content: text("content").notNull(), // The actual fact
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("memory_userId_idx").on(t.userId)]
);

// ── Notebooks ─────────────────────────────────────────────────────────────────
export const notebook = pgTable(
  "notebook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Notebook"),
    content: text("content").notNull().default(""),
    color: text("color").notNull().default("#8AB4F8"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("notebook_userId_idx").on(t.userId)]
);

// ── Scheduled Prompts & Tasks ────────────────────────────────────────────────
export const scheduledTask = pgTable(
  "scheduled_task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    model: text("model").notNull().default("gemini-3.5-flash"),
    frequency: text("frequency").notNull().default("daily"), // daily | weekly | once | hourly
    timeOfDay: text("timeOfDay").notNull().default("09:00"),
    status: text("status").notNull().default("active"), // active | paused
    lastRunAt: timestamp("lastRunAt"),
    nextRunAt: timestamp("nextRunAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("scheduled_task_userId_idx").on(t.userId)]
);

// ── Saved Library Items ───────────────────────────────────────────────────────
export const libraryItem = pgTable(
  "library_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").notNull(), // image | document | code | prompt | note
    content: text("content").notNull(),
    previewUrl: text("previewUrl"),
    tags: jsonb("tags").$type<string[]>().default([]),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [index("library_item_userId_idx").on(t.userId)]
);


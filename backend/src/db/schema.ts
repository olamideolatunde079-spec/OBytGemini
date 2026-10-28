import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Helper: Better Auth passes timestamps as ISO strings, not Date objects.
// Using mode("string") tells Drizzle to keep them as strings instead of
// converting to Date — prevents "value.toISOString is not a function" errors.
const ts = (name: string) => timestamp(name, { mode: "string" });
const tsNotNull = (name: string) => timestamp(name, { mode: "string" }).notNull();

// ── Better Auth required tables ───────────────────────────────────────────────
// Table and column names must match Better Auth's expectations exactly.

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
    selectedProvider: text("selectedProvider").notNull().default("groq"),
    selectedModel: text("selectedModel").notNull().default("openai/gpt-oss-120b"),
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

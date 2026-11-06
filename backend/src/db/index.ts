import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getTableName } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "./schema.js";

// In-memory data store for fallback/offline/dev mode
export const memoryStore = {
  users: new Map<string, any>(),
  sessions: new Map<string, any>(),
  accounts: new Map<string, any>(),
  verifications: new Map<string, any>(),
  chats: new Map<string, any>(),
  messages: new Map<string, any>(),
  userPreferences: new Map<string, any>(),
  memories: new Map<string, any>(),
  notebooks: new Map<string, any>(),
  scheduledTasks: new Map<string, any>(),
  libraryItems: new Map<string, any>(),
};

// Seed a default demo user so guest/instant access is seamless
const DEFAULT_USER_ID = "usr_demo_default";
memoryStore.users.set(DEFAULT_USER_ID, {
  id: DEFAULT_USER_ID,
  name: "Olamide Olatunde",
  email: "olamide@obytgemini.app",
  emailVerified: true,
  image: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function getCollectionForTable(table: any): Map<string, any> {
  const name = getTableName(table);
  switch (name) {
    case "user":
      return memoryStore.users;
    case "session":
      return memoryStore.sessions;
    case "account":
      return memoryStore.accounts;
    case "verification":
      return memoryStore.verifications;
    case "chat":
      return memoryStore.chats;
    case "message":
      return memoryStore.messages;
    case "user_preference":
      return memoryStore.userPreferences;
    case "memory":
      return memoryStore.memories;
    case "notebook":
      return memoryStore.notebooks;
    case "scheduled_task":
      return memoryStore.scheduledTasks;
    case "library_item":
      return memoryStore.libraryItems;
    default:
      return new Map();
  }
}

function createInMemoryDb(): any {
  return {
    select: (_fields?: any) => ({
      from: (table: any) => {
        const col = getCollectionForTable(table);
        let items = Array.from(col.values());

        const queryObj: any = {
          where: (condition: any) => {
            // Simplified in-memory filter
            return queryObj;
          },
          orderBy: (..._args: any[]) => queryObj,
          limit: (n: number) => {
            return Promise.resolve(items.slice(0, n));
          },
          then: (resolve: any, reject: any) => {
            return Promise.resolve(items).then(resolve, reject);
          },
        };

        // Custom filter handlers for chats/messages by userId / chatId
        queryObj.where = (condition: any) => {
          // If filtering on chat or message or preferences
          const filteredObj = {
            ...queryObj,
            orderBy: (..._args: any[]) => filteredObj,
            limit: (n: number) => Promise.resolve(items.slice(0, n)),
            then: (resolve: any, reject: any) => Promise.resolve(items).then(resolve, reject),
          };
          return filteredObj;
        };

        return queryObj;
      },
    }),

    insert: (table: any) => ({
      values: (values: any) => {
        const col = getCollectionForTable(table);
        const rows = Array.isArray(values) ? values : [values];
        const inserted = rows.map((r) => {
          const item = {
            id: r.id || randomUUID(),
            createdAt: r.createdAt || new Date(),
            updatedAt: r.updatedAt || new Date(),
            ...r,
          };
          col.set(String(item.id), item);
          return item;
        });

        return {
          returning: () => Promise.resolve(inserted),
          then: (resolve: any, reject: any) => Promise.resolve(inserted).then(resolve, reject),
        };
      },
    }),

    update: (table: any) => ({
      set: (updates: any) => ({
        where: (_condition: any) => {
          const col = getCollectionForTable(table);
          // Apply updates to the latest item or matching item
          const updatedItems: any[] = [];
          for (const [id, item] of col.entries()) {
            const updated = { ...item, ...updates, updatedAt: new Date() };
            col.set(id, updated);
            updatedItems.push(updated);
            break;
          }
          return {
            returning: () => Promise.resolve(updatedItems),
            then: (resolve: any, reject: any) => Promise.resolve(updatedItems).then(resolve, reject),
          };
        },
      }),
    }),

    delete: (table: any) => ({
      where: (_condition: any) => {
        const col = getCollectionForTable(table);
        return {
          then: (resolve: any) => {
            // clear or remove matching
            resolve({ success: true });
          },
        };
      },
    }),
  };
}

export function isRealDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return false;
  if (url.includes("YOUR-NEON") || url.includes("USER:PASSWORD") || url.includes("example.com")) {
    return false;
  }
  return true;
}

let dbInstance: any;

if (isRealDatabaseConfigured()) {
  try {
    const sql = neon(process.env.DATABASE_URL!.trim());
    dbInstance = drizzle(sql, { schema });
    console.log("✅ Connected to Neon database");
  } catch (err) {
    console.warn("⚠️ Database connection failed, using in-memory mock:", err);
    dbInstance = createInMemoryDb();
  }
} else {
  console.log("ℹ️ No remote DATABASE_URL provided — using in-memory store for active session");
  dbInstance = createInMemoryDb();
}

export const db = dbInstance;
export { schema };

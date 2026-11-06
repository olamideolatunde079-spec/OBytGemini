import type {
  Chat,
  Message,
  ModelInfo,
  UserPreference,
  Memory,
  AppConfig,
  ResearchResult,
  Notebook,
  ScheduledTask,
  LibraryItem,
} from "../types/index.js";

const BASE = "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Config ────────────────────────────────────────────────────────────────────
export async function fetchConfig(): Promise<AppConfig> {
  return fetchJSON<AppConfig>(`${BASE}/config`);
}

// ── Models — cached in memory ────────────────────────────────────────────────
let _modelsCache: ModelInfo[] | null = null;

export async function fetchModels(): Promise<ModelInfo[]> {
  if (_modelsCache) return _modelsCache;
  const data = await fetchJSON<{ models: ModelInfo[] }>(`${BASE}/models`);
  _modelsCache = data.models;
  return _modelsCache;
}

// ── Chats ─────────────────────────────────────────────────────────────────────
export async function fetchChats(): Promise<Chat[]> {
  const data = await fetchJSON<{ chats: Chat[] }>(`${BASE}/chats`);
  return data.chats;
}

export async function createChat(params?: {
  provider?: string;
  model?: string;
}): Promise<Chat> {
  const data = await fetchJSON<{ chat: Chat }>(`${BASE}/chats`, {
    method: "POST",
    body: JSON.stringify({
      selectedProvider: params?.provider,
      selectedModel: params?.model,
    }),
  });
  return data.chat;
}

export async function fetchChat(
  id: string
): Promise<{ chat: Chat; messages: Message[] }> {
  return fetchJSON(`${BASE}/chats/${id}`);
}

export async function deleteChat(id: string): Promise<void> {
  await fetchJSON(`${BASE}/chats/${id}`, { method: "DELETE" });
}

export async function updateChat(
  id: string,
  data: Partial<Pick<Chat, "title" | "selectedProvider" | "selectedModel">>
): Promise<Chat> {
  const res = await fetchJSON<{ chat: Chat }>(`${BASE}/chats/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.chat;
}

// ── Image generation ──────────────────────────────────────────────────────────
export async function generateImage(payload: {
  provider: "google" | "openai";
  prompt: string;
}): Promise<{ provider: string; model: string; mimeType: string; data: string }> {
  const data = await fetchJSON<{
    image: { provider: string; model: string; mimeType: string; data: string };
  }>(`${BASE}/images`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.image;
}

// ── Preferences ───────────────────────────────────────────────────────────────
export async function fetchPreferences(): Promise<UserPreference> {
  const data = await fetchJSON<{ preference: UserPreference }>(`${BASE}/preferences`);
  return data.preference;
}

export async function savePreferences(pref: {
  preferredProvider: string;
  preferredModel: string;
}): Promise<UserPreference> {
  const data = await fetchJSON<{ preference: UserPreference }>(`${BASE}/preferences`, {
    method: "PUT",
    body: JSON.stringify(pref),
  });
  return data.preference;
}

// ── Memories ──────────────────────────────────────────────────────────────────
export async function fetchMemories(): Promise<Memory[]> {
  const data = await fetchJSON<{ memories: Memory[] }>(`${BASE}/preferences/memories`);
  return data.memories;
}

export async function createMemory(memory: {
  category: Memory["category"];
  content: string;
}): Promise<Memory> {
  const data = await fetchJSON<{ memory: Memory }>(`${BASE}/preferences/memories`, {
    method: "POST",
    body: JSON.stringify(memory),
  });
  return data.memory;
}

export async function deleteMemory(id: string): Promise<void> {
  await fetchJSON(`${BASE}/preferences/memories/${id}`, { method: "DELETE" });
}

export async function clearMemories(): Promise<void> {
  await fetchJSON(`${BASE}/preferences/memories`, { method: "DELETE" });
}

// ── Research ──────────────────────────────────────────────────────────────────
export async function fetchResearchStatus(): Promise<{
  available: boolean;
  provider: string | null;
  message: string;
}> {
  return fetchJSON(`${BASE}/research/status`);
}

export async function runResearch(query: string): Promise<ResearchResult> {
  return fetchJSON<ResearchResult>(`${BASE}/research`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

// ── Streaming message send ────────────────────────────────────────────────────
export async function* sendMessage(
  chatId: string,
  content: string,
  provider?: string,
  model?: string,
  signal?: AbortSignal,
  attachmentDataUrl?: string | null,
  attachmentMimeType?: string | null
): AsyncGenerator<{
  chunk?: string;
  done?: boolean;
  error?: string;
  model?: string;
  provider?: string;
  image?: boolean;
  mimeType?: string;
  data?: string;
}> {
  const res = await fetch(`${BASE}/chats/${chatId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      provider,
      model,
      attachmentDataUrl: attachmentDataUrl ?? undefined,
      attachmentMimeType: attachmentMimeType ?? undefined,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    yield { error: body.error ?? `HTTP ${res.status}` };
    return;
  }

  if (!res.body) {
    yield { error: "The server did not return a response stream." };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6));
          } catch {
            throw new Error("The server returned an invalid streaming response.");
          }
        }
      }
      if (done) break;
    }

    if (buffer.startsWith("data: ")) {
      try {
        yield JSON.parse(buffer.slice(6));
      } catch {
        throw new Error("The server returned an invalid streaming response.");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Notebooks ─────────────────────────────────────────────────────────────────
export async function fetchNotebooks(): Promise<Notebook[]> {
  const data = await fetchJSON<{ notebooks: Notebook[] }>(`${BASE}/notebooks`);
  return data.notebooks;
}

export async function createNotebook(params: { title?: string; content?: string; color?: string }): Promise<Notebook> {
  const data = await fetchJSON<{ notebook: Notebook }>(`${BASE}/notebooks`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return data.notebook;
}

export async function fetchNotebook(id: string): Promise<Notebook> {
  const data = await fetchJSON<{ notebook: Notebook }>(`${BASE}/notebooks/${id}`);
  return data.notebook;
}

export async function updateNotebook(id: string, updates: Partial<Pick<Notebook, "title" | "content" | "color">>): Promise<Notebook> {
  const data = await fetchJSON<{ notebook: Notebook }>(`${BASE}/notebooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return data.notebook;
}

export async function deleteNotebook(id: string): Promise<void> {
  await fetchJSON(`${BASE}/notebooks/${id}`, { method: "DELETE" });
}

// ── Scheduled Tasks ───────────────────────────────────────────────────────────
export async function fetchScheduledTasks(): Promise<ScheduledTask[]> {
  const data = await fetchJSON<{ tasks: ScheduledTask[] }>(`${BASE}/scheduled`);
  return data.tasks;
}

export async function createScheduledTask(params: {
  title: string;
  prompt: string;
  model?: string;
  frequency?: ScheduledTask["frequency"];
  timeOfDay?: string;
}): Promise<ScheduledTask> {
  const data = await fetchJSON<{ task: ScheduledTask }>(`${BASE}/scheduled`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return data.task;
}

export async function updateScheduledTask(
  id: string,
  updates: Partial<Pick<ScheduledTask, "title" | "prompt" | "model" | "frequency" | "timeOfDay" | "status">>
): Promise<ScheduledTask> {
  const data = await fetchJSON<{ task: ScheduledTask }>(`${BASE}/scheduled/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return data.task;
}

export async function runScheduledTask(id: string): Promise<{ success: boolean; result: string }> {
  return fetchJSON<{ success: boolean; result: string }>(`${BASE}/scheduled/${id}/run`, {
    method: "POST",
  });
}

export async function deleteScheduledTask(id: string): Promise<void> {
  await fetchJSON(`${BASE}/scheduled/${id}`, { method: "DELETE" });
}

// ── Library ───────────────────────────────────────────────────────────────────
export async function fetchLibraryItems(type?: string): Promise<LibraryItem[]> {
  const url = type ? `${BASE}/library?type=${encodeURIComponent(type)}` : `${BASE}/library`;
  const data = await fetchJSON<{ items: LibraryItem[] }>(url);
  return data.items;
}

export async function createLibraryItem(params: {
  title: string;
  type: LibraryItem["type"];
  content: string;
  previewUrl?: string;
  tags?: string[];
}): Promise<LibraryItem> {
  const data = await fetchJSON<{ item: LibraryItem }>(`${BASE}/library`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return data.item;
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await fetchJSON(`${BASE}/library/${id}`, { method: "DELETE" });
}

// ── Study Tools ───────────────────────────────────────────────────────────────
export async function generateStudyContent(params: {
  action: "explain" | "flashcards" | "quiz" | "summary";
  topic: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
}): Promise<any> {
  return fetchJSON(`${BASE}/study/generate`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}


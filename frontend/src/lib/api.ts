import type {
  Chat,
  Message,
  ModelInfo,
  UserPreference,
  Memory,
  AppConfig,
  ResearchResult,
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

// ── Models ────────────────────────────────────────────────────────────────────
export async function fetchModels(): Promise<ModelInfo[]> {
  const data = await fetchJSON<{ models: ModelInfo[] }>(`${BASE}/models`);
  return data.models;
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

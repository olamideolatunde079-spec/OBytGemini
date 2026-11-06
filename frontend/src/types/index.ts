export interface ModelInfo {
  provider: string;
  model: string;
  displayName: string;
  available: boolean;
  description?: string;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  selectedProvider: string;
  selectedModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  provider?: string | null;
  model?: string | null;
  /** Client-only: base64 data URL for generated images (not persisted) */
  imageDataUrl?: string | null;
  mimeType?: string | null;
  /** Client-only: attached image for vision requests */
  attachmentDataUrl?: string | null;
  attachmentMimeType?: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface UserPreference {
  preferredProvider: string;
  preferredModel: string;
  settings: Record<string, unknown>;
}

export interface Memory {
  id: string;
  userId: string;
  category: "name" | "preference" | "project" | "interest" | "instruction" | "other";
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  auth: { emailPassword: boolean; github: boolean; google: boolean };
  defaults: { provider: string; model: string };
  features?: {
    research: boolean;
    imageGeneration: boolean;
  };
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export interface ResearchResult {
  researched: boolean;
  query: string;
  answer: string | null;
  sources: ResearchSource[];
  disclaimer: string;
}

export interface Notebook {
  id: string;
  userId: string;
  title: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTask {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  model: string;
  frequency: "daily" | "weekly" | "once" | "hourly";
  timeOfDay: string;
  status: "active" | "paused";
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryItem {
  id: string;
  userId: string;
  title: string;
  type: "image" | "document" | "code" | "prompt" | "note";
  content: string;
  previewUrl?: string | null;
  tags: string[];
  createdAt: string;
}

export interface StudyFlashcard {
  question: string;
  answer: string;
}

export interface StudyQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

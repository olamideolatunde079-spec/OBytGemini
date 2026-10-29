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
  imageDataUrl?: string | null;
  mimeType?: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export type AiTableResult = {
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
  truncated?: boolean;
};

export type AiAction = {
  kind: "confirm";
  tool: string;
  token: string;
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
  expiresAt: string;
};

export type AiExportLink = {
  format: "xlsx" | "csv";
  url: string;
  rows: number;
  truncated: boolean;
};

export type AiDenied = { tool: string; reason: string };

export type AiAnswer = {
  title: string;
  intent: string;
  summary: string[];
  lines: string[];
  groups?: AiTableResult[];
  actions?: AiAction[];
  export?: AiExportLink;
  denied?: AiDenied[];
  meta?: {
    tools: string[];
    durationMs: number;
    period?: { from?: string; to?: string };
    truncated: boolean;
  };
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  time: string;
  answer?: AiAnswer;
  system?: boolean;
};

export type ConversationGroup = "Bugun" | "Kecha" | "Oldingi";

export type Conversation = {
  id: number;
  title: string;
  group: ConversationGroup;
  time: string;
  messages: ChatMessage[];
};

export type QuickPrompt = {
  text: string;
  short: string;
  group: string;
  icon: string;
};

export function formatChatTime(date = new Date()) {
  return date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export function shortTitle(question: string) {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length > 38 ? `${clean.slice(0, 38)}…` : clean;
}

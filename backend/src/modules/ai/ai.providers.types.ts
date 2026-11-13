/** AI LLM provayderlari — OpenAI-compatible universal format. */

export type AiProviderKind = "openai_compatible";

export type AiProviderTier = "free" | "paid" | "local";

/** Diskda saqlanadigan (kalit shifrlangan) yozuv. */
export type AiProviderStored = {
  id: string;
  name: string;
  kind: AiProviderKind;
  tier: AiProviderTier;
  baseUrl: string;
  model: string;
  /** AES-GCM ciphertext (base64url). Bo‘sh = kalit yo‘q. */
  apiKeyEnc: string;
  enabled: boolean;
  /** Kichikroq = avvalroq. */
  priority: number;
  lastOkAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
  cooldownUntil?: string | null;
  failCount?: number;
};

export type AiAssistantSettingsStored = {
  enabled: boolean;
  providers: AiProviderStored[];
};

/** API/UI uchun (kalit yashirilgan). */
export type AiProviderPublic = {
  id: string;
  name: string;
  kind: AiProviderKind;
  tier: AiProviderTier;
  baseUrl: string;
  model: string;
  enabled: boolean;
  priority: number;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  lastOkAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
  cooldownUntil?: string | null;
  failCount?: number;
  /** cooldown ichidami. */
  coolingDown: boolean;
};

export type AiAssistantSettingsPublic = {
  enabled: boolean;
  providers: AiProviderPublic[];
  /** Env fallback (ASSISTANT_API_*) bor-yo‘qligi. */
  envFallbackConfigured: boolean;
};

export type AiProviderPreset = {
  id: string;
  name: string;
  tier: AiProviderTier;
  baseUrl: string;
  model: string;
  hint: string;
};

/** Tez qo‘shish uchun tayyor shablonlar (bepul + pullik + lokal). */
export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    id: "groq",
    name: "Groq (free tier)",
    tier: "free",
    baseUrl: "https://api.groq.com/openai/v1",
    /** llama-3.3-70b-versatile 2026-08-16 dan free/dev uchun o‘chirilgan. */
    model: "openai/gpt-oss-120b",
    hint: "Bepul kvota; OpenAI-compatible (gpt-oss-120b)"
  },
  {
    id: "openrouter-free",
    name: "OpenRouter (free models)",
    tier: "free",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemma-2-9b-it:free",
    hint: "Bepul modellar; key kerak"
  },
  {
    id: "gemini-openai",
    name: "Google Gemini (OpenAI compat)",
    tier: "free",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    hint: "Google AI Studio kaliti"
  },
  {
    id: "openai",
    name: "OpenAI",
    tier: "paid",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "Pullik; barqaror"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    tier: "paid",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    hint: "Arzon pullik"
  },
  {
    id: "lmstudio",
    name: "LM Studio (local)",
    tier: "local",
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "local-model",
    hint: "Lokal; kalit ixtiyoriy (lm-studio)"
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    tier: "local",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3.2",
    hint: "Lokal Ollama OpenAI endpoint"
  },
  {
    id: "custom",
    name: "Custom OpenAI-compatible",
    tier: "paid",
    baseUrl: "https://example.com/v1",
    model: "model-name",
    hint: "Istalgan OpenAI-compatible API"
  }
];

export type AiProviderRuntime = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  priority: number;
};

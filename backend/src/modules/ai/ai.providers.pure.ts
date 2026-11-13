/** AI provider sozlamalari — pure normalize / mask / failover tartibi. */
import { decryptApiKey, encryptApiKey, maskApiKey } from "./ai.providers.crypto";
import type {
  AiAssistantSettingsPublic,
  AiAssistantSettingsStored,
  AiProviderKind,
  AiProviderPublic,
  AiProviderRuntime,
  AiProviderStored,
  AiProviderTier
} from "./ai.providers.types";

const SETTINGS_KEY = "ai_assistant";

export function aiAssistantSettingsKey(): string {
  return SETTINGS_KEY;
}

function asObj(v: unknown): Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asTier(v: unknown): AiProviderTier {
  return v === "free" || v === "paid" || v === "local" ? v : "paid";
}

function asKind(v: unknown): AiProviderKind {
  return "openai_compatible";
}

/** Groq free/dev: eski Llama idlari 2026-08-16 dan 404. */
const GROQ_RETIRED_MODELS: Record<string, string> = {
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama3-8b-8192": "openai/gpt-oss-20b"
};

/** Saqlangan / UI model idni joriy endpoint uchun to‘g‘rilash. */
export function remapProviderModel(baseUrl: string, model: string): string {
  const m = model.trim();
  if (!m) return m;
  const host = baseUrl.toLowerCase();
  if (host.includes("api.groq.com")) {
    return GROQ_RETIRED_MODELS[m] ?? m;
  }
  return m;
}

export function newProviderId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyAiAssistantSettings(): AiAssistantSettingsStored {
  return { enabled: true, providers: [] };
}

export function parseAiAssistantSettings(settingsJson: unknown): AiAssistantSettingsStored {
  const root = asObj(settingsJson);
  const raw = asObj(root[SETTINGS_KEY]);
  const list = Array.isArray(raw.providers) ? raw.providers : [];
  const providers: AiProviderStored[] = [];
  for (const item of list) {
    const o = asObj(item);
    const id = asStr(o.id) || newProviderId();
    const baseUrl = asStr(o.baseUrl).replace(/\/+$/, "");
    const model = remapProviderModel(baseUrl, asStr(o.model));
    providers.push({
      id,
      name: asStr(o.name, "Provider") || "Provider",
      kind: asKind(o.kind),
      tier: asTier(o.tier),
      baseUrl,
      model,
      apiKeyEnc: asStr(o.apiKeyEnc),
      enabled: asBool(o.enabled, true),
      priority: asNum(o.priority, providers.length + 1),
      lastOkAt: asStr(o.lastOkAt) || null,
      lastErrorAt: asStr(o.lastErrorAt) || null,
      lastError: asStr(o.lastError) || null,
      cooldownUntil: asStr(o.cooldownUntil) || null,
      failCount: asNum(o.failCount, 0)
    });
  }
  return { enabled: asBool(raw.enabled, true), providers };
}

export function toPublicProvider(p: AiProviderStored, now = Date.now()): AiProviderPublic {
  const plain = decryptApiKey(p.apiKeyEnc);
  const cool = p.cooldownUntil ? Date.parse(p.cooldownUntil) : NaN;
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    tier: p.tier,
    baseUrl: p.baseUrl,
    model: remapProviderModel(p.baseUrl, p.model),
    enabled: p.enabled,
    priority: p.priority,
    hasApiKey: Boolean(plain),
    apiKeyMasked: maskApiKey(plain),
    lastOkAt: p.lastOkAt ?? null,
    lastErrorAt: p.lastErrorAt ?? null,
    lastError: p.lastError ?? null,
    cooldownUntil: p.cooldownUntil ?? null,
    failCount: p.failCount ?? 0,
    coolingDown: Number.isFinite(cool) && cool > now
  };
}

export function toPublicSettings(
  stored: AiAssistantSettingsStored,
  envFallbackConfigured: boolean,
  now = Date.now()
): AiAssistantSettingsPublic {
  return {
    enabled: stored.enabled,
    providers: stored.providers
      .slice()
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
      .map((p) => toPublicProvider(p, now)),
    envFallbackConfigured
  };
}

export type ProviderPatchInput = {
  id?: string;
  name?: string;
  kind?: AiProviderKind;
  tier?: AiProviderTier;
  baseUrl?: string;
  model?: string;
  /** Yangi kalit; bo‘sh = o‘zgartirmaslik; null = o‘chirish. */
  apiKey?: string | null;
  clearApiKey?: boolean;
  enabled?: boolean;
  priority?: number;
};

/** PUT body → yangi stored (mavjud kalitlarni saqlab). */
export function mergeProvidersPatch(
  current: AiAssistantSettingsStored,
  patch: { enabled?: boolean; providers?: ProviderPatchInput[] }
): AiAssistantSettingsStored {
  const byId = new Map(current.providers.map((p) => [p.id, p]));
  const nextList: AiProviderStored[] = [];
  const incoming = Array.isArray(patch.providers) ? patch.providers : null;

  if (incoming) {
    incoming.forEach((raw, idx) => {
      const id = (raw.id && String(raw.id).trim()) || newProviderId();
      const prev = byId.get(id);
      let apiKeyEnc = prev?.apiKeyEnc ?? "";
      if (raw.clearApiKey === true || raw.apiKey === null) {
        apiKeyEnc = "";
      } else if (typeof raw.apiKey === "string" && raw.apiKey.trim()) {
        apiKeyEnc = encryptApiKey(raw.apiKey);
      }
      const baseUrl = (raw.baseUrl?.trim() || prev?.baseUrl || "").replace(/\/+$/, "").slice(0, 300);
      const modelRaw = (raw.model?.trim() || prev?.model || "").slice(0, 120);
      nextList.push({
        id,
        name: (raw.name?.trim() || prev?.name || `Provider ${idx + 1}`).slice(0, 80),
        kind: "openai_compatible",
        tier: raw.tier ?? prev?.tier ?? "paid",
        baseUrl,
        model: remapProviderModel(baseUrl, modelRaw).slice(0, 120),
        apiKeyEnc,
        enabled: raw.enabled ?? prev?.enabled ?? true,
        priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : prev?.priority ?? idx + 1,
        lastOkAt: prev?.lastOkAt ?? null,
        lastErrorAt: prev?.lastErrorAt ?? null,
        lastError: prev?.lastError ?? null,
        cooldownUntil: prev?.cooldownUntil ?? null,
        failCount: prev?.failCount ?? 0
      });
    });
  } else {
    nextList.push(...current.providers);
  }

  return {
    enabled: patch.enabled ?? current.enabled,
    providers: nextList
  };
}

/** Failover uchun ishga tayyor provayderlar (priority ↑, cooldown tashlab). */
export function pickRuntimeProviders(
  stored: AiAssistantSettingsStored,
  now = Date.now()
): AiProviderRuntime[] {
  if (!stored.enabled) return [];
  return stored.providers
    .filter((p) => p.enabled && p.baseUrl && p.model)
    .filter((p) => {
      const cool = p.cooldownUntil ? Date.parse(p.cooldownUntil) : NaN;
      return !(Number.isFinite(cool) && cool > now);
    })
    .map((p) => {
      const baseUrl = p.baseUrl.replace(/\/+$/, "");
      return {
        id: p.id,
        name: p.name,
        baseUrl,
        model: remapProviderModel(baseUrl, p.model),
        apiKey: decryptApiKey(p.apiKeyEnc) || "no-key",
        priority: p.priority
      };
    })
    .filter((p) => p.baseUrl.startsWith("http"))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

/** Muvaffaqiyatsizlikdan keyin cooldown (sekund). */
export function cooldownSecondsForFailCount(failCount: number): number {
  if (failCount <= 1) return 30;
  if (failCount === 2) return 120;
  if (failCount === 3) return 600;
  return 1800;
}

export function markProviderSuccess(p: AiProviderStored, now = new Date()): AiProviderStored {
  return {
    ...p,
    lastOkAt: now.toISOString(),
    lastError: null,
    lastErrorAt: null,
    cooldownUntil: null,
    failCount: 0
  };
}

export function markProviderFailure(
  p: AiProviderStored,
  error: string,
  now = new Date()
): AiProviderStored {
  const failCount = (p.failCount ?? 0) + 1;
  const sec = cooldownSecondsForFailCount(failCount);
  return {
    ...p,
    failCount,
    lastError: error.slice(0, 240),
    lastErrorAt: now.toISOString(),
    cooldownUntil: new Date(now.getTime() + sec * 1000).toISOString()
  };
}

export function isEnvLlmConfigured(): boolean {
  const base = (process.env.ASSISTANT_API_BASE ?? "").trim();
  const key = (process.env.ASSISTANT_API_KEY ?? "").trim();
  const model = (process.env.ASSISTANT_MODEL ?? "").trim();
  return Boolean(base && model && (key || base.includes("127.0.0.1") || base.includes("localhost")));
}

export function envFallbackRuntime(): AiProviderRuntime | null {
  if (!isEnvLlmConfigured()) return null;
  return {
    id: "__env__",
    name: "Env ASSISTANT_API_*",
    baseUrl: (process.env.ASSISTANT_API_BASE ?? "").replace(/\/+$/, ""),
    model: process.env.ASSISTANT_MODEL ?? "",
    apiKey: process.env.ASSISTANT_API_KEY?.trim() || "lm-studio",
    priority: 9999
  };
}

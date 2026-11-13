/**
 * AI Assistant — OpenAI-compatible LLM client + multi-provider failover.
 *
 * Faqat JSON plan taklif qiladi. Noma’lum intent / xato → null (rules fallback).
 */
import { decryptApiKey } from "./ai.providers.crypto";
import {
  envFallbackRuntime,
  pickRuntimeProviders
} from "./ai.providers.pure";
import {
  loadAiAssistantSettings,
  persistRemappedProviderModels,
  updateProviderHealth
} from "./ai.providers.store";
import type { AiProviderRuntime } from "./ai.providers.types";
import { remapProviderModel } from "./ai.providers.pure";

export type LlmPlanProposal = {
  intent: string;
  params: Record<string, unknown>;
  providerId: string;
  providerName: string;
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function timeoutMs(): number {
  const n = Number(process.env.ASSISTANT_LLM_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 2000 ? Math.floor(n) : 20_000;
}

function maxTokens(): number {
  const n = Number(process.env.ASSISTANT_LLM_MAX_TOKENS);
  return Number.isFinite(n) && n >= 64 ? Math.floor(n) : 800;
}

function isRetryableStatus(status: number): boolean {
  /* 404 model_not_found — boshqa model/provayderga o‘tish uchun retryable. */
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 404 ||
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

type ChatOpts = {
  /** Probe: json_object majburiy emas (gpt-oss reasoning bo‘sh content berishi mumkin). */
  jsonMode?: boolean;
  maxTokens?: number;
};

async function chatCompletion(
  provider: AiProviderRuntime,
  messages: ChatMessage[],
  opts: ChatOpts = {}
): Promise<{ ok: true; text: string } | { ok: false; error: string; retryable: boolean }> {
  const url = `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs());
  const jsonMode = opts.jsonMode !== false;
  const tokens = opts.maxTokens ?? maxTokens();
  const model = remapProviderModel(provider.baseUrl, provider.model);
  try {
    const body: Record<string, unknown> = {
      model,
      temperature: 0,
      max_tokens: tokens,
      messages
    };
    if (jsonMode) body.response_format = { type: "json_object" };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const snippet = errBody.slice(0, 200).replace(/\s+/g, " ");
      return {
        ok: false,
        error: `HTTP ${res.status}${snippet ? `: ${snippet}` : ""}`,
        retryable: isRetryableStatus(res.status)
      };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
    };
    const msg = json.choices?.[0]?.message;
    const text = (msg?.content ?? "").trim() || (msg?.reasoning ?? "").trim();
    if (!text) return { ok: false, error: "Bo‘sh javob", retryable: true };
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, error: aborted ? "timeout" : msg, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

function parseProposal(text: string): { intent: string; params: Record<string, unknown> } | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const intent = typeof obj.intent === "string" ? obj.intent.trim() : "";
    if (!intent) return null;
    const params =
      obj.params != null && typeof obj.params === "object" && !Array.isArray(obj.params)
        ? (obj.params as Record<string, unknown>)
        : {};
    return { intent, params };
  } catch {
    return null;
  }
}

export function buildLlmSystemPrompt(intentCatalog: string[], today: string): string {
  return [
    "Siz SalesArena AI yordamchisisiz.",
    "Faqat JSON qaytaring: {\"intent\":\"...\",\"params\":{...}}.",
    "Boshqa matn, markdown, SQL, URL yozmang.",
    `Bugungi sana (Asia/Tashkent): ${today}.`,
    "Ruxsat etilgan intentlar:",
    intentCatalog.map((i) => `- ${i}`).join("\n"),
    "params: from,to (YYYY-MM-DD), search, limit, sku, amount, status, staff_kind va h.k.",
    "Noma’lum savol → intent: help.capabilities, params: {}."
  ].join("\n");
}

async function orderedProviders(tenantId: number): Promise<AiProviderRuntime[]> {
  const stored = await loadAiAssistantSettings(tenantId);
  const list = pickRuntimeProviders(stored);
  const env = envFallbackRuntime();
  if (env && list.length === 0) return [env];
  if (env) return [...list, env];
  return list;
}

/**
 * Birinchi muvaffaqiyatli provayderdan JSON plan.
 * Ulanish uzilsa / kvota / 5xx → keyingisiga avtomatik.
 */
export async function proposePlanFromLlm(input: {
  tenantId: number;
  question: string;
  today: string;
  intentCatalog: string[];
}): Promise<LlmPlanProposal | null> {
  const providers = await orderedProviders(input.tenantId);
  if (!providers.length) return null;

  const messages: ChatMessage[] = [
    { role: "system", content: buildLlmSystemPrompt(input.intentCatalog, input.today) },
    { role: "user", content: input.question.slice(0, 1000) }
  ];

  for (const provider of providers) {
    const result = await chatCompletion(provider, messages);
    if (result.ok) {
      const parsed = parseProposal(result.text);
      if (!parsed || !input.intentCatalog.includes(parsed.intent)) {
        await updateProviderHealth(input.tenantId, provider.id, {
          ok: false,
          error: parsed ? `unknown intent: ${parsed.intent}` : "invalid json"
        });
        continue;
      }
      await updateProviderHealth(input.tenantId, provider.id, { ok: true });
      return {
        intent: parsed.intent,
        params: parsed.params,
        providerId: provider.id,
        providerName: provider.name
      };
    }
    if (result.retryable) {
      await updateProviderHealth(input.tenantId, provider.id, { ok: false, error: result.error });
      continue;
    }
    await updateProviderHealth(input.tenantId, provider.id, { ok: false, error: result.error });
  }
  return null;
}

/** Sozlamalar «Tekshirish» tugmasi — bitta yoki barcha (failover tartibida). */
export async function probeProviders(input: {
  tenantId: number;
  providerId?: string;
}): Promise<Array<{ id: string; name: string; ok: boolean; error?: string; ms: number }>> {
  const stored = await persistRemappedProviderModels(input.tenantId);
  let list: AiProviderRuntime[] = pickRuntimeProviders({
    ...stored,
    providers: stored.providers.map((p) => ({ ...p, cooldownUntil: null }))
  });
  const env = envFallbackRuntime();
  if (env && !list.some((p) => p.id === env.id)) list = [...list, env];
  if (input.providerId) {
    list = list.filter((p) => p.id === input.providerId);
    if (!list.length) {
      const row = stored.providers.find((p) => p.id === input.providerId);
      if (row?.baseUrl && row.model) {
        const baseUrl = row.baseUrl.replace(/\/+$/, "");
        list = [
          {
            id: row.id,
            name: row.name,
            baseUrl,
            model: remapProviderModel(baseUrl, row.model),
            apiKey: decryptApiKey(row.apiKeyEnc) || "no-key",
            priority: row.priority
          }
        ];
      }
    }
  }

  const out: Array<{ id: string; name: string; ok: boolean; error?: string; ms: number }> = [];
  for (const provider of list) {
    const started = Date.now();
    /* Probe: oddiy ping — json_object + past max_tokens gpt-oss da bo‘sh javob beradi. */
    const result = await chatCompletion(
      provider,
      [
        { role: "system", content: "Reply with the single word: pong" },
        { role: "user", content: "ping" }
      ],
      { jsonMode: false, maxTokens: 256 }
    );
    const ms = Date.now() - started;
    if (result.ok) {
      await updateProviderHealth(input.tenantId, provider.id, { ok: true });
      out.push({ id: provider.id, name: provider.name, ok: true, ms });
    } else {
      await updateProviderHealth(input.tenantId, provider.id, { ok: false, error: result.error });
      out.push({ id: provider.id, name: provider.name, ok: false, error: result.error, ms });
    }
  }
  return out;
}

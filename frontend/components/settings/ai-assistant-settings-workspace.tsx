"use client";

import {
  AiAssistantProviderCard,
  type AiProviderDraft,
  type AiProviderTier
} from "@/components/settings/ai-assistant-provider-card";
import { AccessDeniedBanner } from "@/components/access/access-denied-banner";
import { Button } from "@/components/ui/button";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

type Preset = {
  id: string;
  name: string;
  tier: AiProviderTier;
  baseUrl: string;
  model: string;
  hint: string;
};

type SettingsResponse = {
  settings: {
    enabled: boolean;
    providers: Array<Omit<AiProviderDraft, "apiKey" | "clearApiKey"> & { apiKeyMasked: string | null }>;
    envFallbackConfigured: boolean;
  };
  presets: Preset[];
};

function newLocalId(): string {
  return `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Groq free/dev: retired Llama idlari — UI da ham yangi model ko‘rinsin. */
const GROQ_RETIRED_MODELS: Record<string, string> = {
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama3-8b-8192": "openai/gpt-oss-20b"
};

function remapClientModel(baseUrl: string, model: string): string {
  const m = model.trim();
  if (baseUrl.toLowerCase().includes("api.groq.com") && GROQ_RETIRED_MODELS[m]) {
    return GROQ_RETIRED_MODELS[m]!;
  }
  return m;
}

function fromServer(res: SettingsResponse): { enabled: boolean; providers: AiProviderDraft[] } {
  return {
    enabled: res.settings.enabled,
    providers: res.settings.providers.map((p) => ({
      ...p,
      model: remapClientModel(p.baseUrl, p.model),
      apiKey: "",
      clearApiKey: false
    }))
  };
}

export function AiAssistantSettingsWorkspace() {
  const hydrated = useAuthStoreHydrated();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const canEdit = role === "admin";

  const [draft, setDraft] = useState<{ enabled: boolean; providers: AiProviderDraft[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["ai-assistant-settings", tenantSlug],
    enabled: hydrated && Boolean(tenantSlug) && role === "admin",
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<SettingsResponse>(`/api/${tenantSlug}/ai/settings`);
      return data;
    }
  });

  const baseline = useMemo(
    () => (query.data ? fromServer(query.data) : { enabled: true, providers: [] as AiProviderDraft[] }),
    [query.data]
  );
  const enabled = draft?.enabled ?? baseline.enabled;
  const providers = draft?.providers ?? baseline.providers;

  function setEnabled(next: boolean) {
    setDraft({ enabled: next, providers });
  }
  function setProviders(updater: AiProviderDraft[] | ((prev: AiProviderDraft[]) => AiProviderDraft[])) {
    const next = typeof updater === "function" ? updater(providers) : updater;
    setDraft({ enabled, providers: next });
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        enabled,
        providers: providers.map((p, idx) => ({
          id: p.id.startsWith("new_") ? undefined : p.id,
          name: p.name.trim(),
          tier: p.tier,
          baseUrl: p.baseUrl.trim(),
          model: p.model.trim(),
          enabled: p.enabled,
          priority: p.priority || idx + 1,
          ...(p.clearApiKey ? { clearApiKey: true, apiKey: null } : {}),
          ...(p.apiKey.trim() ? { apiKey: p.apiKey.trim() } : {})
        }))
      };
      const { data } = await api.put<SettingsResponse>(`/api/${tenantSlug}/ai/settings`, body);
      return data;
    },
    onSuccess: async () => {
      setErr(null);
      setMsg("Сохранено");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["ai-assistant-settings", tenantSlug] });
    },
    onError: (e) => {
      setMsg(null);
      setErr(getUserFacingError(e));
    }
  });

  const probeMut = useMutation({
    mutationFn: async (providerId?: string) => {
      const { data } = await api.post<{
        results: Array<{ id: string; name: string; ok: boolean; error?: string; ms: number }>;
        settings: SettingsResponse["settings"];
      }>(`/api/${tenantSlug}/ai/settings/probe`, providerId ? { providerId } : {});
      return data;
    },
    onSuccess: async (data) => {
      setErr(null);
      setMsg(
        data.results
          .map((r) => (r.ok ? `✓ ${r.name} (${r.ms} ms)` : `✗ ${r.name}: ${r.error ?? "error"}`))
          .join(" · ") || "Нет провайдеров"
      );
      /* Eski draft (retired model) qolib ketmasin — server javobini darhol qo‘llaymiz. */
      setDraft(null);
      qc.setQueryData(["ai-assistant-settings", tenantSlug], (old: SettingsResponse | undefined) =>
        old
          ? { ...old, settings: data.settings }
          : { settings: data.settings, presets: [] }
      );
      await qc.invalidateQueries({ queryKey: ["ai-assistant-settings", tenantSlug] });
    },
    onError: (e) => {
      setMsg(null);
      setErr(getUserFacingError(e));
    }
  });

  function move(id: string, dir: -1 | 1) {
    setProviders((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority);
      const i = sorted.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= sorted.length) return prev;
      const a = sorted[i]!;
      const b = sorted[j]!;
      return prev.map((p) => {
        if (p.id === a.id) return { ...p, priority: b.priority };
        if (p.id === b.id) return { ...p, priority: a.priority };
        return p;
      });
    });
  }

  function addFromPreset(preset: Preset) {
    const maxP = providers.reduce((m, p) => Math.max(m, p.priority), 0);
    setProviders((prev) => [
      ...prev,
      {
        id: newLocalId(),
        name: preset.name,
        tier: preset.tier,
        baseUrl: preset.baseUrl,
        model: preset.model,
        apiKey: "",
        clearApiKey: false,
        enabled: true,
        priority: maxP + 1,
        hasApiKey: false,
        apiKeyMasked: null
      }
    ]);
  }

  if (!hydrated) return null;
  if (role !== "admin") {
    return (
      <AccessDeniedBanner
        resource="AI-помощник"
        message="Раздел доступен только администратору."
        primaryHref="/settings"
      />
    );
  }

  const presets = query.data?.presets ?? [];
  const sorted = [...providers].sort((a, b) => a.priority - b.priority);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">AI помощник — API ключи</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Универсальные OpenAI-compatible провайдеры (бесплатные, платные, локальные). Несколько ключей:
          при ошибке, обрыве или исчерпании квоты — автоматический переход к следующему по приоритету.
        </p>
      </div>

      {query.data?.settings.envFallbackConfigured ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          На сервере также задан env fallback (<code>ASSISTANT_API_*</code>) — если в списке нет рабочих
          ключей.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEdit || saveMut.isPending}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          LLM через API включён (иначе только правила / keywords)
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Быстро добавить</h2>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEdit}
              title={p.hint}
              onClick={() => addFromPreset(p)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {p.name}
            </Button>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        {sorted.map((p, idx) => (
          <AiAssistantProviderCard
            key={p.id}
            provider={p}
            index={idx}
            canEdit={canEdit}
            probing={probeMut.isPending}
            onUpdate={(patch) => setProviders((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))}
            onMove={(dir) => move(p.id, dir)}
            onProbe={() => probeMut.mutate(p.id)}
            onRemove={() => setProviders((prev) => prev.filter((x) => x.id !== p.id))}
          />
        ))}
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Провайдеров пока нет — выберите шаблон выше.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!canEdit || saveMut.isPending} onClick={() => saveMut.mutate()}>
          Сохранить
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={probeMut.isPending || providers.length === 0}
          onClick={() => probeMut.mutate(undefined)}
        >
          Проверить всех (по очереди)
        </Button>
      </div>
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-rose-700">{err}</p> : null}
      {query.isError ? <p className="text-sm text-rose-700">{getUserFacingError(query.error)}</p> : null}
    </div>
  );
}

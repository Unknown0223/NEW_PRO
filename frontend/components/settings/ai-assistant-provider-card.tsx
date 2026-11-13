"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

export type AiProviderTier = "free" | "paid" | "local";

export type AiProviderDraft = {
  id: string;
  name: string;
  tier: AiProviderTier;
  baseUrl: string;
  model: string;
  apiKey: string;
  clearApiKey: boolean;
  enabled: boolean;
  priority: number;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  lastOkAt?: string | null;
  lastError?: string | null;
  cooldownUntil?: string | null;
  coolingDown?: boolean;
  failCount?: number;
};

const TIER_LABEL: Record<AiProviderTier, string> = {
  free: "Бесплатный",
  paid: "Платный",
  local: "Локальный"
};

export function AiAssistantProviderCard({
  provider: p,
  index,
  canEdit,
  probing,
  onUpdate,
  onMove,
  onProbe,
  onRemove
}: {
  provider: AiProviderDraft;
  index: number;
  canEdit: boolean;
  probing: boolean;
  onUpdate: (patch: Partial<AiProviderDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onProbe: () => void;
  onRemove: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="text-sm font-semibold">{p.name || "Провайдер"}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {TIER_LABEL[p.tier]}
          </span>
          {p.coolingDown ? <span className="text-[11px] text-amber-700">пауза (failover)</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" disabled={!canEdit} onClick={() => onMove(-1)}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" disabled={!canEdit} onClick={() => onMove(1)}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={probing} onClick={onProbe}>
            Проверить
          </Button>
          <Button type="button" size="icon" variant="ghost" disabled={!canEdit} onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-rose-600" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Название</Label>
          <Input value={p.name} disabled={!canEdit} onChange={(e) => onUpdate({ name: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Тип</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={p.tier}
            disabled={!canEdit}
            onChange={(e) => onUpdate({ tier: e.target.value as AiProviderTier })}
          >
            <option value="free">Бесплатный</option>
            <option value="paid">Платный</option>
            <option value="local">Локальный</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Base URL (OpenAI-compatible …/v1)</Label>
          <Input
            value={p.baseUrl}
            disabled={!canEdit}
            placeholder="https://api.groq.com/openai/v1"
            onChange={(e) => onUpdate({ baseUrl: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Model</Label>
          <Input value={p.model} disabled={!canEdit} onChange={(e) => onUpdate({ model: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">
            API Key{p.hasApiKey && !p.clearApiKey ? " (сохранён — оставьте пустым)" : ""}
          </Label>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={p.hasApiKey && !p.clearApiKey ? p.apiKeyMasked ?? "••••••••" : "sk-..."}
            value={p.apiKey}
            disabled={!canEdit || p.clearApiKey}
            onChange={(e) => onUpdate({ apiKey: e.target.value })}
          />
          {p.hasApiKey ? (
            <button
              type="button"
              className={cn(
                "mt-1 text-[11px] hover:underline",
                p.clearApiKey ? "text-amber-700" : "text-rose-700"
              )}
              disabled={!canEdit}
              onClick={() => onUpdate({ clearApiKey: !p.clearApiKey, apiKey: "" })}
            >
              {p.clearApiKey ? "Отменить удаление ключа" : "Удалить сохранённый ключ"}
            </button>
          ) : null}
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={p.enabled}
          disabled={!canEdit}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
        />
        Участвует в failover
      </label>
      {p.lastError ? (
        <p className="mt-2 text-[11px] text-rose-700">Последняя ошибка: {p.lastError}</p>
      ) : p.lastOkAt ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Последний успех: {p.lastOkAt}</p>
      ) : null}
    </section>
  );
}

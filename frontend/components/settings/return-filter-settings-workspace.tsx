"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import {
  detectReturnFilterMode,
  invalidateReturnFilterCaches,
  previewForSettings,
  RETURN_FILTER_MODE_PRESETS,
  returnFilterProfileQueryKey,
  type ReturnFilterModeId,
  type ReturnFilterSettings
} from "@/lib/return-filter-settings";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TenantProfile = {
  return_filter: ReturnFilterSettings;
};

function draftFromForm(
  periodEnabled: boolean,
  periodUnit: "day" | "month",
  periodValue: string,
  balanceZeroEnabled: boolean
): ReturnFilterSettings {
  const pv = Number.parseInt(periodValue, 10);
  return {
    period_enabled: periodEnabled,
    period_unit: periodUnit,
    period_value: Number.isFinite(pv) && pv >= 1 ? pv : 7,
    balance_zero_enabled: balanceZeroEnabled
  };
}

export function ReturnFilterSettingsWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const isAdmin = role === "admin";
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();

  const [periodEnabled, setPeriodEnabled] = useState(true);
  const [periodUnit, setPeriodUnit] = useState<"day" | "month">("day");
  const [periodValue, setPeriodValue] = useState("7");
  const [balanceZeroEnabled, setBalanceZeroEnabled] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: returnFilterProfileQueryKey(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data: body } = await api.get<TenantProfile>(`/api/${tenantSlug}/settings/profile`);
      return body.return_filter;
    }
  });

  useEffect(() => {
    if (!data) return;
    setPeriodEnabled(data.period_enabled);
    setPeriodUnit(data.period_unit);
    setPeriodValue(String(data.period_value));
    setBalanceZeroEnabled(data.balance_zero_enabled);
  }, [data]);

  const draft = useMemo(
    () => draftFromForm(periodEnabled, periodUnit, periodValue, balanceZeroEnabled),
    [periodEnabled, periodUnit, periodValue, balanceZeroEnabled]
  );

  const activeMode = useMemo(() => detectReturnFilterMode(draft), [draft]);
  const preview = useMemo(() => previewForSettings(draft), [draft]);

  const applyPreset = (modeId: ReturnFilterModeId) => {
    const preset = RETURN_FILTER_MODE_PRESETS.find((p) => p.id === modeId);
    if (!preset) return;
    const s = preset.settings;
    setPeriodEnabled(s.period_enabled);
    setPeriodUnit(s.period_unit);
    setPeriodValue(String(s.period_value));
    setBalanceZeroEnabled(s.balance_zero_enabled);
    setMsg(null);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const pv = Number.parseInt(periodValue, 10);
      if (!Number.isFinite(pv) || pv < 1) throw new Error("Davr qiymati noto‘g‘ri");
      await api.patch(`/api/${tenantSlug}/settings/profile`, {
        return_filter: {
          period_enabled: periodEnabled,
          period_unit: periodUnit,
          period_value: pv,
          balance_zero_enabled: balanceZeroEnabled
        }
      });
    },
    onSuccess: async () => {
      setMsg("Saqlandi — qaytarish sahifasida yangi filtr qo‘llanadi.");
      await invalidateReturnFilterCaches(qc, tenantSlug);
    },
    onError: (e) => setMsg(getUserFacingError(e))
  });

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-8">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Qaytarish filtri</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Vozvrat s polki (po zakaz va erkin) uchun qaysi yetkazilgan zakazlar tanlash ro‘yxatida ko‘rinadi.
        </p>
      </header>

      {isError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {getUserFacingError(error)}
        </p>
      ) : null}

      <section className="space-y-3" aria-labelledby="filter-mode-heading">
        <h2 id="filter-mode-heading" className="text-sm font-medium text-foreground">
          Rejim tanlash
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {RETURN_FILTER_MODE_PRESETS.map((preset) => {
            const p = previewForSettings(preset.settings);
            const active = activeMode === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={!isAdmin || isLoading}
                onClick={() => applyPreset(preset.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  active
                    ? "border-teal-600 bg-teal-50/90 ring-1 ring-teal-600/30"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{preset.label}</span>
                  {active ? <Check className="h-4 w-4 shrink-0 text-teal-700" aria-hidden /> : null}
                </div>
                <span className="mt-1 block text-[11px] font-medium text-teal-800">{preset.short}</span>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{p.body}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          preview.warning
            ? "border-amber-300 bg-amber-50 text-amber-950"
            : "border-teal-200 bg-teal-50/80 text-teal-950"
        )}
        aria-live="polite"
      >
        <div className="flex gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <div>
            <p className="font-semibold">{preview.title}</p>
            <p className="mt-1 leading-relaxed">{preview.body}</p>
            {preview.warning ? <p className="mt-2 text-xs font-medium">{preview.warning}</p> : null}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium text-foreground">Batafsil sozlamalar</h2>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={periodEnabled}
            disabled={!isAdmin || isLoading}
            onChange={(e) => setPeriodEnabled(e.target.checked)}
          />
          <span>
            <span className="font-medium">Davr filtri</span>
            <span className="mt-0.5 block text-muted-foreground">
              Yetkazilgan zakazlar sanasi cheklanadi.
            </span>
          </span>
        </label>

        {periodEnabled ? (
          <div className="flex flex-wrap items-end gap-4 border-l-2 border-teal-200/80 pl-4">
            <div className="space-y-1.5">
              <Label htmlFor="period-value">Son</Label>
              <Input
                id="period-value"
                type="number"
                min={1}
                max={365}
                value={periodValue}
                disabled={!isAdmin}
                onChange={(e) => setPeriodValue(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-unit">Birlik</Label>
              <select
                id="period-unit"
                value={periodUnit}
                disabled={!isAdmin}
                onChange={(e) => setPeriodUnit(e.target.value === "month" ? "month" : "day")}
                className="h-10 min-w-[100px] rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="day">kun</option>
                <option value="month">oy</option>
              </select>
            </div>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={balanceZeroEnabled}
            disabled={!isAdmin || isLoading}
            onChange={(e) => setBalanceZeroEnabled(e.target.checked)}
          />
          <span>
            <span className="font-medium">Balans 0 filtri</span>
            <span className="mt-0.5 block text-muted-foreground">
              Zakaz + to‘lov ledger bo‘yicha oxirgi «balans 0» nuqtasidan keyingi zakazlar.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-600">
        <p className="font-medium text-slate-800">Test mijoz</p>
        <p className="mt-1">
          <code className="rounded bg-white px-1 py-0.5">FILTR-TEST mijoz (polki)</code> — backend:{" "}
          <code className="rounded bg-white px-1 py-0.5">npm run seed:return-filter-test</code>
        </p>
      </section>

      <footer className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {isAdmin ? (
          <Button type="button" disabled={saveMut.isPending || isLoading} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Faqat admin o‘zgartira oladi.</p>
        )}
        {msg ? (
          <p
            className={cn(
              "text-sm",
              msg.startsWith("Saqlandi") ? "text-teal-800" : "text-red-700"
            )}
          >
            {msg}
          </p>
        ) : null}
      </footer>
    </div>
  );
}

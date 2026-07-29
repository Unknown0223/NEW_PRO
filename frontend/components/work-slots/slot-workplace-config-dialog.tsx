"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { SlotEntitlementsEditor } from "@/components/work-slots/slot-entitlements-editor";
import {
  SlotExpeditorRulesEditor,
  parseExpeditorAssignmentRules
} from "@/components/work-slots/slot-expeditor-rules-editor";
import { SlotSkladchikEntitlementsEditor } from "@/components/work-slots/slot-skladchik-entitlements-editor";
import type { AgentEntitlementSavePayload } from "@/components/staff/agent-restrictions-dialog";
import type { ExpeditorAssignmentRules } from "@/components/staff/expeditors-workspace";
import { api } from "@/lib/api";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { priceTypeOptionsFromResponse, type PriceTypeOption } from "@/lib/price-type-label";
import { STALE } from "@/lib/query-stale";
import type { WorkSlotListItem, WorkSlotType } from "@/lib/work-slots-types";
import {
  slotWorkplaceConfigTabs,
  type SlotWorkplaceConfigTabId
} from "@/components/work-slots/work-slots-utils";

type PickerOpt = { id: number; name: string };
type TradeDirection = { id: number; name: string; code: string | null };

type ConfigTab = SlotWorkplaceConfigTabId;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  slotId?: number | null;
  bulkMode?: boolean;
  slotIds?: number[];
  /** Как у агентов: «Выбрано агентов: N» */
  bulkSummary?: string;
  slotType?: WorkSlotType;
  warehouses: PickerOpt[];
  onSaved: () => void;
};

function parseEntitlements(
  raw: WorkSlotListItem["entitlements"] | undefined
): AgentEntitlementSavePayload {
  if (!raw || typeof raw !== "object") return { price_types: [], product_rules: [] };
  const price_types = Array.isArray(raw.price_types)
    ? raw.price_types.filter((x): x is string => typeof x === "string")
    : [];
  const product_rules = Array.isArray(raw.product_rules)
    ? (raw.product_rules as AgentEntitlementSavePayload["product_rules"])
    : [];
  return { price_types, product_rules };
}

type FormState = {
  directionId: string;
  returnWarehouseId: string;
  priceType: string;
  priceTypes: string[];
  consignment: boolean;
  consignmentLimit: string;
  consignmentIgnoreDebt: boolean;
  closeDay: string;
  closeHour: string;
  closeMinute: string;
  entitlements: AgentEntitlementSavePayload;
  skladchikEntitlements: Record<string, boolean>;
  expeditorRules: ExpeditorAssignmentRules;
};

function emptyForm(): FormState {
  return {
    directionId: "",
    returnWarehouseId: "",
    priceType: "",
    priceTypes: [],
    consignment: false,
    consignmentLimit: "",
    consignmentIgnoreDebt: false,
    closeDay: "25",
    closeHour: "0",
    closeMinute: "0",
    entitlements: { price_types: [], product_rules: [] },
    skladchikEntitlements: {},
    expeditorRules: {}
  };
}

function formFromSlot(d: WorkSlotListItem): FormState {
  return {
    directionId: d.direction_id != null ? String(d.direction_id) : "",
    returnWarehouseId: d.return_warehouse_id != null ? String(d.return_warehouse_id) : "",
    priceType: d.price_type ?? "",
    priceTypes: d.price_types ?? [],
    consignment: d.consignment,
    consignmentLimit: d.consignment_limit_amount ?? "",
    consignmentIgnoreDebt: d.consignment_ignore_previous_months_debt,
    closeDay: String(d.consignment_close_day ?? 25),
    closeHour: String(d.consignment_close_hour ?? 0),
    closeMinute: String(d.consignment_close_minute ?? 0),
    entitlements: parseEntitlements(d.entitlements),
    skladchikEntitlements: d.warehouse_staff_entitlements ?? {},
    expeditorRules: parseExpeditorAssignmentRules(d.expeditor_assignment_rules)
  };
}

export function SlotWorkplaceConfigDialog({
  open,
  onOpenChange,
  tenant,
  slotId = null,
  bulkMode = false,
  slotIds = [],
  bulkSummary,
  slotType: slotTypeProp,
  warehouses,
  onSaved
}: Props) {
  const [slot, setSlot] = useState<WorkSlotListItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [baseline, setBaseline] = useState<FormState>(emptyForm);
  const [tab, setTab] = useState<ConfigTab>("main");
  const [restrictionsOpen, setRestrictionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlotType: WorkSlotType | undefined = bulkMode
    ? slotTypeProp
    : (slot?.slot_type as WorkSlotType | undefined);

  const tabs = useMemo(
    () => slotWorkplaceConfigTabs(effectiveSlotType),
    [effectiveSlotType]
  );

  const tradeDirectionsQ = useQuery({
    queryKey: ["trade-directions", tenant, "slot-config"],
    enabled: open && Boolean(tenant),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: TradeDirection[] }>(
        `/api/${tenant}/trade-directions?is_active=true`
      );
      return data.data;
    }
  });

  const priceTypesQ = useQuery({
    queryKey: ["price-types", tenant, "slot-config"],
    enabled: open && Boolean(tenant),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[]; options?: PriceTypeOption[] }>(
        `/api/${tenant}/price-types?kind=sale`
      );
      return priceTypeOptionsFromResponse(data);
    }
  });

  const ptLabel = useMemo(() => {
    const map = Object.fromEntries((priceTypesQ.data ?? []).map((o) => [o.id, o.label]));
    return (key: string) => map[key] ?? key;
  }, [priceTypesQ.data]);

  const applyForm = useCallback((next: FormState) => {
    setForm(next);
    setBaseline(next);
  }, []);

  const load = useCallback(async () => {
    if (!tenant || !slotId || bulkMode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: WorkSlotListItem }>(`/api/${tenant}/work-slots/${slotId}`);
      const d = res.data;
      setSlot(d);
      applyForm(formFromSlot(d));
      setTab("main");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [tenant, slotId, bulkMode, applyForm]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTab("main");
    if (bulkMode) {
      setSlot(null);
      applyForm(emptyForm());
      setLoading(false);
      return;
    }
    if (slotId) void load();
  }, [open, bulkMode, slotId, load, applyForm]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab("main");
  }, [tabs, tab]);

  const togglePriceType = (key: string) => {
    setForm((prev) => ({
      ...prev,
      priceTypes: prev.priceTypes.includes(key)
        ? prev.priceTypes.filter((x) => x !== key)
        : [...prev.priceTypes, key]
    }));
  };

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  const buildConfigBody = (): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      direction_id: form.directionId.trim() ? Number.parseInt(form.directionId.trim(), 10) : null,
      return_warehouse_id: form.returnWarehouseId.trim()
        ? Number.parseInt(form.returnWarehouseId.trim(), 10)
        : null
    };

    // Agentga xos: narx, mahsulot cheklovi — konsignatsiya alohida sahifada.
    if (effectiveSlotType === "agent") {
      body.price_type = form.priceType.trim() || null;
      body.price_types = form.priceTypes;
      body.entitlements = {
        price_types: form.entitlements.price_types,
        product_rules: form.entitlements.product_rules
      };
    }
    if (effectiveSlotType === "skladchik") {
      body.warehouse_staff_entitlements = form.skladchikEntitlements;
    }
    if (effectiveSlotType === "expeditor") {
      body.expeditor_assignment_rules = form.expeditorRules;
    }
    return body;
  };

  const handleReset = () => {
    setForm(bulkMode ? emptyForm() : { ...baseline });
    setError(null);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (bulkMode && !dirty) {
        setError("Нет изменений для сохранения. Отредактируйте хотя бы одно поле.");
        return;
      }
      const config = buildConfigBody();
      if (bulkMode) {
        if (!slotIds.length) throw new Error("Не выбраны места");
        await apiFetch(`/api/${tenant}/work-slots/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot_ids: slotIds, ...config })
        });
      } else {
        if (!slotId) return;
        const patch = { ...config };
        if (effectiveSlotType === "agent") {
          const mergedEnt =
            slot?.entitlements && typeof slot.entitlements === "object"
              ? {
                  ...slot.entitlements,
                  price_types: form.entitlements.price_types,
                  product_rules: form.entitlements.product_rules
                }
              : config.entitlements;
          patch.entitlements = mergedEnt;
        }
        await apiFetch(`/api/${tenant}/work-slots/${slotId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const title = bulkMode
    ? "Групповая конфигурация"
    : slot
      ? `Конфигурация: ${slot.slot_code}`
      : "Конфигурация места";

  const summaryLine = bulkMode
    ? (bulkSummary ?? `Выбрано мест: ${slotIds.length}`)
    : slot?.active_user_name
      ? `Сотрудник: ${slot.active_user_name}`
      : slot
        ? "Место свободно"
        : null;

  const panel = (() => {
    switch (tab) {
      case "main":
        return (
          <div className="space-y-5 text-[13px]">
            <div className="space-y-2">
              <Label>Направление торговли</Label>
              <FilterSelect
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                emptyLabel="— не задано —"
                aria-label="Направление торговли"
                value={form.directionId}
                onChange={(e) => setForm((p) => ({ ...p, directionId: e.target.value }))}
              >
                {(tradeDirectionsQ.data ?? []).map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.code ? `${d.name} (${d.code})` : d.name}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <div className="space-y-2">
              <Label>Склад возврата</Label>
              <FilterSelect
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                emptyLabel="—"
                aria-label="Склад возврата"
                value={form.returnWarehouseId}
                onChange={(e) => setForm((p) => ({ ...p, returnWarehouseId: e.target.value }))}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.name}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>
        );
      case "prices":
        return (
          <div className="space-y-5 text-[13px]">
            <div className="space-y-2">
              <Label>Основной тип цены</Label>
              <FilterSelect
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                emptyLabel="—"
                aria-label="Основной тип цены"
                value={form.priceType}
                onChange={(e) => setForm((p) => ({ ...p, priceType: e.target.value }))}
              >
                {(priceTypesQ.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <div className="space-y-2">
              <Label>Дополнительные типы цен</Label>
              <div className="max-h-56 space-y-0 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/70 bg-card/40">
                {(priceTypesQ.data ?? []).map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="accent-teal-600"
                      checked={form.priceTypes.includes(o.id)}
                      onChange={() => togglePriceType(o.id)}
                    />
                    {ptLabel(o.id)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      case "limits":
        return (
          <div className="space-y-4 text-[13px]">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Типы цен в entitlements и продуктовые правила — на уровне рабочего места (как раньше
              «Ограничения» у агента). Консигнация и лимит — в разделе{" "}
              <a href="/settings/spravochnik/consignment" className="font-medium text-teal-700 underline">
                Пользователи → Консигнация
              </a>
              .
            </p>
            <div className="rounded-lg border border-border/70 bg-muted/15 p-4">
              <p className="mb-3 text-sm text-foreground">
                Выбрано:{" "}
                <span className="font-semibold text-teal-700">
                  {form.entitlements.price_types.length}
                </span>{" "}
                типов цен ·{" "}
                <span className="font-semibold text-teal-700">
                  {form.entitlements.product_rules.length}
                </span>{" "}
                правил по продуктам
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setRestrictionsOpen(true)}>
                Редактировать ограничения
              </Button>
            </div>
          </div>
        );
      case "skladchik":
        return (
          <SlotSkladchikEntitlementsEditor
            value={form.skladchikEntitlements}
            onChange={(v) => setForm((p) => ({ ...p, skladchikEntitlements: v }))}
          />
        );
      case "expeditor":
        return (
          <SlotExpeditorRulesEditor
            tenant={tenant}
            value={form.expeditorRules}
            onChange={(v) => setForm((p) => ({ ...p, expeditorRules: v }))}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-border/70 bg-muted/10 px-6 py-3.5 pr-12 sm:px-8">
            <DialogTitle className="font-sans text-[15px] font-normal leading-snug tracking-tight text-foreground/85 sm:text-base">
              {title}
            </DialogTitle>
            {summaryLine ? (
              <p className="mt-1 text-xs text-muted-foreground">{summaryLine}</p>
            ) : null}
            {bulkMode ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Показаны стандартные настройки. При сохранении значения применятся ко всем выбранным
                рабочим местам.
                {dirty ? (
                  <span className="mt-1 block font-medium text-teal-700 dark:text-teal-300">
                    Есть изменения для применения
                  </span>
                ) : null}
              </p>
            ) : null}
            {error ? (
              <div
                role="alert"
                className="mt-2 rounded-md border border-red-500/40 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800 dark:bg-red-950/40 dark:text-red-200"
              >
                {error}
              </div>
            ) : null}
            <DialogDescription className="sr-only">
              Конфигурация рабочего места: цены, ограничения, консигнация
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="px-8 py-12 text-sm text-muted-foreground">Загрузка…</p>
          ) : (
            <div className="flex min-h-0 max-h-[min(65vh,640px)] gap-0">
              <nav className="w-[13.5rem] shrink-0 overflow-y-auto border-r border-border/70 bg-muted/90 p-2 dark:bg-muted/40">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "mb-0.5 w-full rounded-md px-2.5 py-2 text-left text-[12px] font-medium leading-snug transition-colors",
                      tab === t.id
                        ? "bg-teal-600 text-white shadow-sm dark:bg-teal-600"
                        : "text-foreground/90 hover:bg-card/70 dark:hover:bg-muted/60"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
              <div className="min-h-0 flex-1 overflow-y-auto bg-background px-6 py-4 sm:px-8">
                {panel}
              </div>
            </div>
          )}

          <DialogFooter className="mx-0 mb-0 flex flex-row flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/10 px-6 py-4 sm:px-8">
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-red-500/70 text-red-600 hover:bg-red-50 dark:border-red-400/60 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={handleReset}
              disabled={saving || loading}
            >
              Сбросить настройки
            </Button>
            <Button
              type="button"
              className="shrink-0 bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
              disabled={
                saving ||
                loading ||
                (bulkMode ? slotIds.length === 0 || !dirty : !slotId)
              }
              onClick={() => void submit()}
            >
              {saving ? "…" : bulkMode ? "Применить к выбранным" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SlotEntitlementsEditor
        open={restrictionsOpen}
        tenant={tenant}
        initial={form.entitlements}
        priceTypes={(priceTypesQ.data ?? []).map((o) => o.id)}
        priceTypeLabels={Object.fromEntries((priceTypesQ.data ?? []).map((o) => [o.id, o.label]))}
        bulkMode={bulkMode}
        bulkCount={slotIds.length}
        bulkLabel={bulkSummary}
        onClose={() => setRestrictionsOpen(false)}
        onSave={(next) => {
          setForm((p) => ({ ...p, entitlements: next, priceTypes: next.price_types }));
          setRestrictionsOpen(false);
        }}
      />
    </>
  );
}

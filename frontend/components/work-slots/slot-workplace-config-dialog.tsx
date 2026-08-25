"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  Shield,
  Smartphone,
  Tags,
  Truck,
  Warehouse
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { SlotEntitlementsEditor } from "@/components/work-slots/slot-entitlements-editor";
import {
  SlotExpeditorRulesEditor,
  parseExpeditorAssignmentRules
} from "@/components/work-slots/slot-expeditor-rules-editor";
import { SlotSkladchikEntitlementsEditor } from "@/components/work-slots/slot-skladchik-entitlements-editor";
import {
  AgentConfigurationsDialog,
  type AgentConfigDialogRow
} from "@/components/staff/agent-configurations-dialog";
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
  type SlotWorkplaceConfigTab,
  type SlotWorkplaceConfigTabId
} from "@/components/work-slots/work-slots-utils";

type PickerOpt = { id: number; name: string };
type TradeDirection = { id: number; name: string; code: string | null };

const TAB_ICONS: Record<SlotWorkplaceConfigTab["icon"], ReactNode> = {
  layout: <LayoutGrid className="h-4 w-4 shrink-0" />,
  tags: <Tags className="h-4 w-4 shrink-0" />,
  shield: <Shield className="h-4 w-4 shrink-0" />,
  smartphone: <Smartphone className="h-4 w-4 shrink-0" />,
  truck: <Truck className="h-4 w-4 shrink-0" />,
  warehouse: <Warehouse className="h-4 w-4 shrink-0" />
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  /** Bitta bo‘lim — chap tab menyu yo‘q */
  section: SlotWorkplaceConfigTabId;
  slotId?: number | null;
  bulkMode?: boolean;
  slotIds?: number[];
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
    entitlements: parseEntitlements(d.entitlements),
    skladchikEntitlements: d.warehouse_staff_entitlements ?? {},
    expeditorRules: parseExpeditorAssignmentRules(d.expeditor_assignment_rules)
  };
}

export function SlotWorkplaceConfigDialog({
  open,
  onOpenChange,
  tenant,
  section,
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
  const [mobileSaving, setMobileSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlotType: WorkSlotType | undefined = bulkMode
    ? slotTypeProp
    : (slot?.slot_type as WorkSlotType | undefined);

  const sectionMeta = useMemo(() => {
    const tabs = slotWorkplaceConfigTabs(effectiveSlotType);
    return (
      tabs.find((t) => t.id === section) ?? {
        id: section,
        label: section,
        icon: "layout" as const
      }
    );
  }, [effectiveSlotType, section]);

  const tradeDirectionsQ = useQuery({
    queryKey: ["trade-directions", tenant, "slot-config"],
    enabled: open && Boolean(tenant) && section === "main",
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
    enabled: open && Boolean(tenant) && (section === "prices" || section === "limits"),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[]; options?: PriceTypeOption[] }>(
        `/api/${tenant}/price-types?kind=sale`
      );
      return priceTypeOptionsFromResponse(data);
    }
  });

  const paymentMethodsQ = useQuery({
    queryKey: ["settings-profile-pay", tenant, "slot-mobile"],
    enabled: open && Boolean(tenant) && section === "mobile",
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_method_entries?: Array<{
            id: string;
            name: string;
            code?: string | null;
            active?: boolean;
          }>;
        };
      }>(`/api/${tenant}/settings/profile`);
      return data.references?.payment_method_entries ?? [];
    }
  });

  const mobileAgentRow = useMemo((): AgentConfigDialogRow | null => {
    if (!slot) return null;
    const ent =
      slot.entitlements && typeof slot.entitlements === "object"
        ? (slot.entitlements as AgentConfigDialogRow["agent_entitlements"])
        : {};
    return {
      id: slot.id,
      fio: slot.label ?? slot.slot_code,
      code: slot.slot_code,
      login: slot.slot_code,
      agent_entitlements: ent
    };
  }, [slot]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [tenant, slotId, bulkMode, applyForm]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (bulkMode) {
      setSlot(null);
      applyForm(emptyForm());
      setLoading(false);
      return;
    }
    if (slotId) void load();
  }, [open, bulkMode, slotId, load, applyForm]);

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
    if (section === "main") {
      return {
        direction_id: form.directionId.trim() ? Number.parseInt(form.directionId.trim(), 10) : null,
        return_warehouse_id: form.returnWarehouseId.trim()
          ? Number.parseInt(form.returnWarehouseId.trim(), 10)
          : null
      };
    }
    if (section === "prices") {
      return {
        price_type: form.priceType.trim() || null,
        price_types: form.priceTypes
      };
    }
    if (section === "skladchik") {
      return { warehouse_staff_entitlements: form.skladchikEntitlements };
    }
    if (section === "expeditor") {
      return { expeditor_assignment_rules: form.expeditorRules };
    }
    return {};
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
        await apiFetch(`/api/${tenant}/work-slots/${slotId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config)
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

  const titleBase = sectionMeta.label;
  const title = bulkMode
    ? `Группа · ${titleBase}`
    : slot
      ? `${titleBase}: ${slot.slot_code}`
      : titleBase;

  const summaryLine = bulkMode
    ? (bulkSummary ?? `Выбрано мест: ${slotIds.length}`)
    : slot?.active_user_name
      ? `Сотрудник: ${slot.active_user_name}`
      : slot
        ? "Место свободно"
        : null;

  /** Mobil — to‘liq sozlamalar oynasi (oraliq modal yo‘q). */
  if (section === "mobile") {
    const mobileReady = bulkMode || mobileAgentRow != null;
    return (
      <AgentConfigurationsDialog
        open={open && !loading && mobileReady}
        agent={bulkMode ? null : mobileAgentRow}
        bulkMode={bulkMode}
        bulkSummary={bulkSummary ?? (slot ? `${titleBase}: ${slot.slot_code}` : undefined)}
        saving={mobileSaving || loading}
        paymentMethodEntries={paymentMethodsQ.data}
        onClose={() => onOpenChange(false)}
        onSave={async (ent) => {
          setMobileSaving(true);
          try {
            const mobile_config = (ent as { mobile_config?: unknown }).mobile_config;
            if (bulkMode) {
              if (!slotIds.length) throw new Error("Не выбраны места");
              await apiFetch(`/api/${tenant}/work-slots/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  slot_ids: slotIds,
                  entitlements: { mobile_config }
                })
              });
            } else {
              if (!slotId || !slot) return;
              const mergedEnt = {
                ...(typeof slot.entitlements === "object" && slot.entitlements
                  ? slot.entitlements
                  : {}),
                mobile_config
              };
              await apiFetch(`/api/${tenant}/work-slots/${slotId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entitlements: mergedEnt })
              });
            }
            onOpenChange(false);
            onSaved();
          } finally {
            setMobileSaving(false);
          }
        }}
      />
    );
  }

  /** Cheklovlar — to‘liq SlotEntitlementsEditor. */
  if (section === "limits") {
    return (
      <SlotEntitlementsEditor
        open={open && !loading}
        tenant={tenant}
        initial={form.entitlements}
        priceTypes={(priceTypesQ.data ?? []).map((o) => o.id)}
        priceTypeLabels={Object.fromEntries((priceTypesQ.data ?? []).map((o) => [o.id, o.label]))}
        bulkMode={bulkMode}
        bulkCount={slotIds.length}
        bulkLabel={bulkSummary ?? (slot ? slot.slot_code : undefined)}
        onClose={() => onOpenChange(false)}
        onSave={async (next) => {
          const body = {
            entitlements: {
              ...(slot?.entitlements && typeof slot.entitlements === "object"
                ? slot.entitlements
                : {}),
              price_types: next.price_types,
              product_rules: next.product_rules
            }
          };
          if (bulkMode) {
            await apiFetch(`/api/${tenant}/work-slots/bulk`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                slot_ids: slotIds,
                entitlements: {
                  price_types: next.price_types,
                  product_rules: next.product_rules
                }
              })
            });
          } else if (slotId) {
            await apiFetch(`/api/${tenant}/work-slots/${slotId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            });
          }
          onOpenChange(false);
          onSaved();
        }}
      />
    );
  }

  const panel = (() => {
    switch (section) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92vh] gap-0 overflow-hidden p-0",
          section === "main" || section === "prices" ? "max-w-lg sm:max-w-lg" : "max-w-3xl sm:max-w-3xl"
        )}
      >
        <DialogHeader className="border-b border-border/70 bg-muted/10 px-6 py-3.5 pr-12 sm:px-8">
          <DialogTitle className="flex items-center gap-2.5 font-sans text-[15px] font-normal leading-snug tracking-tight text-foreground/85 sm:text-base">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-teal-200 bg-teal-50 text-teal-700">
              {TAB_ICONS[sectionMeta.icon]}
            </span>
            {title}
          </DialogTitle>
          {summaryLine ? (
            <p className="mt-1 text-xs text-muted-foreground">{summaryLine}</p>
          ) : null}
          {bulkMode ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Значения применятся ко всем выбранным местам.
              {dirty ? (
                <span className="mt-1 block font-medium text-teal-700">Есть изменения</span>
              ) : null}
            </p>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="mt-2 rounded-md border border-red-500/40 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {error}
            </div>
          ) : null}
          <DialogDescription className="sr-only">{titleBase}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="px-8 py-12 text-sm text-muted-foreground">Загрузка…</p>
        ) : (
          <div className="min-h-0 max-h-[min(65vh,640px)] overflow-y-auto bg-background px-6 py-4 sm:px-8">
            {panel}
          </div>
        )}

        <DialogFooter className="mx-0 mb-0 flex flex-row flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/10 px-6 py-4 sm:px-8">
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-red-500/70 text-red-600 hover:bg-red-50"
            onClick={handleReset}
            disabled={saving || loading}
          >
            Сбросить
          </Button>
          <Button
            type="button"
            className="shrink-0 bg-teal-600 text-white hover:bg-teal-700"
            disabled={
              saving || loading || (bulkMode ? slotIds.length === 0 || !dirty : !slotId)
            }
            onClick={() => void submit()}
          >
            {saving ? "…" : bulkMode ? "Применить к выбранным" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

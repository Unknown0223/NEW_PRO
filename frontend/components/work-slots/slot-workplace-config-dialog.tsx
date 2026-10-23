"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  Shield,
  Smartphone,
  Tags,
  Truck,
  Users,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { StaffPositionSelect } from "@/components/staff/staff-position-select";
import { SlotEntitlementsEditor } from "@/components/work-slots/slot-entitlements-editor";
import {
  SlotExpeditorRulesEditor,
  parseExpeditorAssignmentRules
} from "@/components/work-slots/slot-expeditor-rules-editor";
import { SlotSkladchikEntitlementsEditor } from "@/components/work-slots/slot-skladchik-entitlements-editor";
import { SlotSupervisorTeamEditor } from "@/components/work-slots/slot-supervisor-team-editor";
import { AgentTemplateModal } from "@/components/staff/agent-workspace-template-ui";
import {
  AgentConfigurationsDialog,
  type AgentConfigDialogRow
} from "@/components/staff/agent-configurations-dialog";
import type { AgentEntitlementSavePayload } from "@/components/staff/agent-restrictions-dialog";
import type { ExpeditorAssignmentRules } from "@/components/staff/expeditors-workspace";
import { api } from "@/lib/api";
import { apiFetch } from "@/lib/api-client";
import {
  mergeSlotEntitlementsForEditor,
  parseSlotEntitlements
} from "@/lib/slot-entitlements-merge";
import { cn } from "@/lib/utils";
import { priceTypeOptionsFromResponse, type PriceTypeOption } from "@/lib/price-type-label";
import { STALE } from "@/lib/query-stale";
import {
  UNLIMITED_MAX_SESSIONS,
  isUnlimitedMaxSessions
} from "@/lib/max-sessions";
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
  warehouse: <Warehouse className="h-4 w-4 shrink-0" />,
  users: <Users className="h-4 w-4 shrink-0" />
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
  return parseSlotEntitlements(raw);
}

type FormState = {
  directionId: string;
  returnWarehouseId: string;
  /** Occupant User — write-through via work-slots PATCH (not WorkSlot columns). */
  position: string;
  appAccess: boolean;
  maxSessions: string;
  priceType: string;
  priceTypes: string[];
  entitlements: AgentEntitlementSavePayload;
  skladchikEntitlements: Record<string, boolean>;
  expeditorRules: ExpeditorAssignmentRules;
  superviseeAgentSlotIds: number[];
};

const EMPTY_SLOT_IDS: number[] = [];

function emptyForm(): FormState {
  return {
    directionId: "",
    returnWarehouseId: "",
    position: "",
    appAccess: true,
    maxSessions: "1",
    priceType: "",
    priceTypes: [],
    entitlements: { price_types: [], product_rules: [] },
    skladchikEntitlements: {},
    expeditorRules: {},
    superviseeAgentSlotIds: []
  };
}

function formFromSlot(d: WorkSlotListItem): FormState {
  return {
    directionId: d.direction_id != null ? String(d.direction_id) : "",
    returnWarehouseId: d.return_warehouse_id != null ? String(d.return_warehouse_id) : "",
    position: d.active_user_position ?? "",
    appAccess: d.active_user_app_access ?? true,
    maxSessions:
      d.active_user_max_sessions != null ? String(d.active_user_max_sessions) : "1",
    priceType: d.price_type ?? "",
    priceTypes: d.price_types ?? [],
    entitlements: parseEntitlements(d.entitlements),
    skladchikEntitlements: d.warehouse_staff_entitlements ?? {},
    expeditorRules: parseExpeditorAssignmentRules(d.expeditor_assignment_rules),
    superviseeAgentSlotIds: Array.isArray(d.supervisee_agent_slot_ids)
      ? d.supervisee_agent_slot_ids.filter((id) => Number.isFinite(id) && id > 0)
      : []
  };
}

export function SlotWorkplaceConfigDialog({
  open,
  onOpenChange,
  tenant,
  section,
  slotId = null,
  bulkMode = false,
  slotIds = EMPTY_SLOT_IDS,
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
  const [limitsMixed, setLimitsMixed] = useState(false);
  /** Editor faqat slot entitlements yuklangandan keyin ochiladi — aks holda belgilar bo‘sh ko‘rinadi. */
  const [limitsHydrated, setLimitsHydrated] = useState(false);

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

  const slotIdsKey = slotIds.join(",");

  const loadBulkLimits = useCallback(async () => {
    const ids = slotIdsKey
      ? slotIdsKey
          .split(",")
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (!tenant || ids.length === 0) {
      applyForm(emptyForm());
      setLimitsMixed(false);
      setLimitsHydrated(true);
      return;
    }
    setLoading(true);
    setLimitsHydrated(false);
    setError(null);
    try {
      const ents = await Promise.all(
        ids.map(async (id) => {
          const res = await apiFetch<{ data: WorkSlotListItem }>(`/api/${tenant}/work-slots/${id}`);
          return parseEntitlements(res.data.entitlements);
        })
      );
      const { merged, mixed } = mergeSlotEntitlementsForEditor(ents);
      applyForm({ ...emptyForm(), entitlements: merged });
      setLimitsMixed(mixed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      applyForm(emptyForm());
      setLimitsMixed(false);
    } finally {
      setLoading(false);
      setLimitsHydrated(true);
    }
  }, [tenant, slotIdsKey, applyForm]);

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
      setLimitsHydrated(true);
    }
  }, [tenant, slotId, bulkMode, applyForm]);

  useEffect(() => {
    if (!open) {
      setLimitsHydrated(false);
      setLimitsMixed(false);
      return;
    }
    setError(null);
    if (bulkMode) {
      setSlot(null);
      if (section === "limits") {
        void loadBulkLimits();
        return;
      }
      setLimitsMixed(false);
      applyForm(emptyForm());
      setLoading(false);
      return;
    }
    setLimitsMixed(false);
    if (section === "limits") setLimitsHydrated(false);
    if (slotId) void load();
  }, [open, bulkMode, slotId, section, load, loadBulkLimits, applyForm]);

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
      const ms = Number.parseInt(form.maxSessions, 10);
      const body: Record<string, unknown> = {
        direction_id: form.directionId.trim() ? Number.parseInt(form.directionId.trim(), 10) : null,
        return_warehouse_id: form.returnWarehouseId.trim()
          ? Number.parseInt(form.returnWarehouseId.trim(), 10)
          : null
      };
      // Occupant fields: backend writes to active User (no WorkSlot columns).
      // Bulk: applies to each selected slot that has an active occupant.
      body.position = form.position.trim() || null;
      body.app_access = form.appAccess;
      body.max_sessions = Number.isFinite(ms) && isUnlimitedMaxSessions(ms)
        ? UNLIMITED_MAX_SESSIONS
        : Number.isFinite(ms) && ms >= 1
          ? ms
          : 1;
      return body;
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
    if (section === "team") {
      return { supervisee_agent_slot_ids: form.superviseeAgentSlotIds };
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
    const mobileVariant = effectiveSlotType === "supervisor" ? "supervisor" : "agent";
    return (
      <AgentConfigurationsDialog
        open={open && !loading && mobileReady}
        agent={bulkMode ? null : mobileAgentRow}
        bulkMode={bulkMode}
        bulkSummary={bulkSummary ?? (slot ? `${titleBase}: ${slot.slot_code}` : undefined)}
        saving={mobileSaving || loading}
        paymentMethodEntries={paymentMethodsQ.data}
        variant={mobileVariant}
        onClose={() => onOpenChange(false)}
        onSave={async (ent, opts) => {
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
                  mobile_config_mode: opts?.replaceMobileConfig ? "replace" : "merge",
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
    if (!open) return null;
    const limitsReady = limitsHydrated && !loading;
    if (!limitsReady) {
      return (
        <AgentTemplateModal
          title={bulkMode ? "Групповые ограничения" : "Ограничения места"}
          onClose={() => onOpenChange(false)}
          width="max-w-3xl"
        >
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              Загрузка сохранённых ограничений…
            </p>
          )}
        </AgentTemplateModal>
      );
    }
    return (
      <SlotEntitlementsEditor
        open={open}
        tenant={tenant}
        initial={form.entitlements}
        priceTypes={(priceTypesQ.data ?? []).map((o) => o.id)}
        priceTypeLabels={Object.fromEntries((priceTypesQ.data ?? []).map((o) => [o.id, o.label]))}
        bulkMode={bulkMode}
        bulkCount={slotIds.length}
        bulkLabel={bulkSummary ?? (slot ? slot.slot_code : undefined)}
        mixedHint={limitsMixed}
        loadError={error}
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
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">
                Должность, доступ к приложению и лимит сессий — у активного сотрудника на этом
                месте (сохраняется в карточку пользователя). Код места — в списке слотов.
              </p>
              {!bulkMode && !slot?.active_user_id ? (
                <p className="text-xs text-amber-800">
                  Место свободно — поля сотрудника применятся после назначения.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label>Должность</Label>
                <StaffPositionSelect
                  tenantSlug={tenant}
                  value={form.position}
                  onChange={(v) => setForm((p) => ({ ...p, position: v }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Макс. сессий</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={form.maxSessions === "0" ? "∞" : form.maxSessions}
                    disabled={form.maxSessions === "0"}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        maxSessions: e.target.value.replace(/\D/g, "")
                      }))
                    }
                    className="h-10"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="accent-teal-600"
                      checked={form.maxSessions === "0"}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          maxSessions: e.target.checked ? "0" : "1"
                        }))
                      }
                    />
                    Неограниченно
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Доступ к приложению</Label>
                  <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
                    <input
                      type="checkbox"
                      className="accent-teal-600"
                      checked={form.appAccess}
                      onChange={(e) => setForm((p) => ({ ...p, appAccess: e.target.checked }))}
                    />
                    {form.appAccess ? "Вкл" : "Выкл"}
                  </label>
                </div>
              </div>
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
      case "team":
        return (
          <SlotSupervisorTeamEditor
            tenant={tenant}
            value={form.superviseeAgentSlotIds}
            onChange={(v) => setForm((p) => ({ ...p, superviseeAgentSlotIds: v }))}
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

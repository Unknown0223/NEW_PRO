"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { ConsignmentCloseScheduleFields } from "@/components/staff/consignment-close-schedule-fields";
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
import { priceTypeOptionsFromResponse, type PriceTypeOption } from "@/lib/price-type-label";
import { STALE } from "@/lib/query-stale";
import type { WorkSlotListItem } from "@/lib/work-slots-types";
import { WorkSlotsMultiSelect } from "./work-slots-multi-select";

type PickerOpt = { id: number; name: string };
type TradeDirection = { id: number; name: string; code: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  slotId: number | null;
  warehouses: PickerOpt[];
  onSaved: () => void;
};

function parseEntitlements(raw: WorkSlotListItem["entitlements"]): AgentEntitlementSavePayload {
  const price_types = Array.isArray(raw.price_types)
    ? raw.price_types.filter((x): x is string => typeof x === "string")
    : [];
  const product_rules = Array.isArray(raw.product_rules)
    ? (raw.product_rules as AgentEntitlementSavePayload["product_rules"])
    : [];
  return { price_types, product_rules };
}

export function SlotWorkplaceConfigDialog({
  open,
  onOpenChange,
  tenant,
  slotId,
  warehouses,
  onSaved
}: Props) {
  const [slot, setSlot] = useState<WorkSlotListItem | null>(null);
  const [directionId, setDirectionId] = useState("");
  const [returnWarehouseId, setReturnWarehouseId] = useState("");
  const [priceType, setPriceType] = useState("");
  const [priceTypes, setPriceTypes] = useState<string[]>([]);
  const [consignment, setConsignment] = useState(false);
  const [consignmentLimit, setConsignmentLimit] = useState("");
  const [consignmentIgnoreDebt, setConsignmentIgnoreDebt] = useState(false);
  const [closeDay, setCloseDay] = useState("25");
  const [closeHour, setCloseHour] = useState("0");
  const [closeMinute, setCloseMinute] = useState("0");
  const [entitlements, setEntitlements] = useState<AgentEntitlementSavePayload>({
    price_types: [],
    product_rules: []
  });
  const [skladchikEntitlements, setSkladchikEntitlements] = useState<Record<string, boolean>>({});
  const [expeditorRules, setExpeditorRules] = useState<ExpeditorAssignmentRules>({});
  const [restrictionsOpen, setRestrictionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    if (!tenant || !slotId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: WorkSlotListItem }>(`/api/${tenant}/work-slots/${slotId}`);
      const d = res.data;
      setSlot(d);
      setDirectionId(d.direction_id != null ? String(d.direction_id) : "");
      setReturnWarehouseId(d.return_warehouse_id != null ? String(d.return_warehouse_id) : "");
      setPriceType(d.price_type ?? "");
      setPriceTypes(d.price_types ?? []);
      setConsignment(d.consignment);
      setConsignmentLimit(d.consignment_limit_amount ?? "");
      setConsignmentIgnoreDebt(d.consignment_ignore_previous_months_debt);
      setCloseDay(String(d.consignment_close_day ?? 25));
      setCloseHour(String(d.consignment_close_hour ?? 0));
      setCloseMinute(String(d.consignment_close_minute ?? 0));
      setEntitlements(parseEntitlements(d.entitlements));
      setSkladchikEntitlements(d.warehouse_staff_entitlements ?? {});
      setExpeditorRules(parseExpeditorAssignmentRules(d.expeditor_assignment_rules));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [tenant, slotId]);

  useEffect(() => {
    if (!open || !slotId) return;
    void load();
  }, [open, slotId, load]);

  const togglePriceType = (key: string) => {
    setPriceTypes((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const submit = async () => {
    if (!slotId || !slot) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        direction_id: directionId.trim() ? Number.parseInt(directionId.trim(), 10) : null,
        return_warehouse_id: returnWarehouseId.trim()
          ? Number.parseInt(returnWarehouseId.trim(), 10)
          : null,
        price_type: priceType.trim() || null,
        price_types: priceTypes,
        entitlements: {
          ...slot.entitlements,
          price_types: entitlements.price_types,
          product_rules: entitlements.product_rules
        },
        consignment,
        consignment_limit_amount: consignmentLimit.trim() ? consignmentLimit.trim() : null,
        consignment_ignore_previous_months_debt: consignmentIgnoreDebt,
        consignment_close_day: Number.parseInt(closeDay, 10) || 25,
        consignment_close_hour: Number.parseInt(closeHour, 10) || 0,
        consignment_close_minute: Number.parseInt(closeMinute, 10) || 0
      };
      if (slot.slot_type === "skladchik") {
        body.warehouse_staff_entitlements = skladchikEntitlements;
      }
      if (slot.slot_type === "expeditor") {
        body.expeditor_assignment_rules = expeditorRules;
      }
      await apiFetch(`/api/${tenant}/work-slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(92vh,880px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-muted/25 px-6 py-4">
            <DialogTitle>Конфигурация места</DialogTitle>
            {slot ? (
              <p className="text-xs text-muted-foreground">
                {slot.slot_code}
                {slot.label ? ` — ${slot.label}` : ""}
              </p>
            ) : null}
          </DialogHeader>
          {loading ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Загрузка…</p>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="space-y-1">
                <Label>Направление торговли</Label>
                <FilterSelect
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  emptyLabel="— не задано —"
                  aria-label="Направление торговли"
                  value={directionId}
                  onChange={(e) => setDirectionId(e.target.value)}
                >
                  {(tradeDirectionsQ.data ?? []).map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name}
                      {t.code ? ` (${t.code})` : ""}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              <div className="space-y-1">
                <Label>Склад возврата</Label>
                <WorkSlotsMultiSelect
                  variant="form"
                  multiple={false}
                  placeholder="Склад возврата"
                  items={[
                    { id: "__none__", title: "—" },
                    ...warehouses.map((w) => ({ id: String(w.id), title: w.name }))
                  ]}
                  selectedValues={returnWarehouseId ? [returnWarehouseId] : []}
                  onChange={(next) => {
                    const v = next[0] ?? "";
                    setReturnWarehouseId(v === "__none__" ? "" : v);
                  }}
                />
              </div>

              <div className="space-y-1">
                <Label>Основной тип цены</Label>
                <FilterSelect
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  emptyLabel="—"
                  aria-label="Основной тип цены"
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value)}
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
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-2">
                  {(priceTypesQ.data ?? []).map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-teal-600"
                        checked={priceTypes.includes(o.id)}
                        onChange={() => togglePriceType(o.id)}
                      />
                      {ptLabel(o.id)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Ограничения по продуктам и entitlements — на уровне места.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setRestrictionsOpen(true)}>
                  Редактировать ограничения ({entitlements.price_types.length} типов ·{" "}
                  {entitlements.product_rules.length} правил)
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={consignment}
                    onChange={(e) => setConsignment(e.target.checked)}
                    className="accent-teal-600"
                  />
                  Консигнация
                </label>
                {consignment ? (
                  <>
                    <div className="space-y-1">
                      <Label>Лимит консигнации</Label>
                      <Input
                        value={consignmentLimit}
                        onChange={(e) => setConsignmentLimit(e.target.value)}
                        placeholder="Сумма"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={consignmentIgnoreDebt}
                        onChange={(e) => setConsignmentIgnoreDebt(e.target.checked)}
                      />
                      Игнорировать долг прошлых месяцев
                    </label>
                    <ConsignmentCloseScheduleFields
                      closeDay={closeDay}
                      closeHour={closeHour}
                      closeMinute={closeMinute}
                      onCloseDayChange={setCloseDay}
                      onCloseHourChange={setCloseHour}
                      onCloseMinuteChange={setCloseMinute}
                    />
                  </>
                ) : null}
              </div>

              {slot?.slot_type === "skladchik" ? (
                <SlotSkladchikEntitlementsEditor
                  value={skladchikEntitlements}
                  onChange={setSkladchikEntitlements}
                />
              ) : null}

              {slot?.slot_type === "expeditor" ? (
                <SlotExpeditorRulesEditor tenant={tenant} value={expeditorRules} onChange={setExpeditorRules} />
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          )}
          <DialogFooter className="mx-0 mb-0 shrink-0 gap-3 border-t bg-muted/25 px-6 py-5 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={saving || loading} onClick={() => void submit()}>
              {saving ? "…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SlotEntitlementsEditor
        open={restrictionsOpen}
        tenant={tenant}
        initial={entitlements}
        priceTypes={(priceTypesQ.data ?? []).map((o) => o.id)}
        priceTypeLabels={Object.fromEntries((priceTypesQ.data ?? []).map((o) => [o.id, o.label]))}
        onClose={() => setRestrictionsOpen(false)}
        onSave={(next) => {
          setEntitlements(next);
          setRestrictionsOpen(false);
        }}
      />
    </>
  );
}

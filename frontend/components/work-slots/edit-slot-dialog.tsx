"use client";

import { useEffect, useMemo, useState } from "react";
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

import { WorkSlotsMultiSelect } from "./work-slots-multi-select";
import { apiFetch } from "@/lib/api-client";
import { buildZoneRegionCityCascadeOptions } from "@/lib/territory-client-filters";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import type { RefSelectOption } from "@/lib/ref-select-options";
import type { TerritoryNode } from "@/lib/territory-tree";
import type { WorkSlotListItem, WorkSlotType } from "@/lib/work-slots-types";
import {
  WorkSlotsLocationFields,
  type WorkSlotsLocationValues
} from "./work-slots-location-fields";
import { SLOT_ACTIVE_STATUS_ITEMS, SLOT_TYPE_OPTIONS } from "./work-slots-utils";

type PickerOpt = { id: number; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  slotId: number | null;
  branchOptions: string[];
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
  clientRefs?: {
    zones?: string[];
    regions?: string[];
    cities?: string[];
    region_options?: { value: string; label: string }[];
    city_options?: { value: string; label: string }[];
    city_territory_hints?: Record<string, { city_label?: string | null }>;
  };
  territoryNodes: TerritoryNode[];
  onSaved: () => void;
};

const emptyLocation = (): WorkSlotsLocationValues => ({
  territoryZone: "",
  territoryOblast: "",
  territoryCity: "",
  territoryZoneList: [],
  territoryOblastList: [],
  territoryCityList: [],
  warehouseId: null,
  cashDeskId: null
});

export function EditSlotDialog({
  open,
  onOpenChange,
  tenant,
  slotId,
  branchOptions,
  warehouses,
  cashDesks,
  clientRefs,
  territoryNodes,
  onSaved
}: Props) {
  const [original, setOriginal] = useState<WorkSlotListItem | null>(null);
  const [slotCode, setSlotCode] = useState("");
  const [label, setLabel] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [slotType, setSlotType] = useState<WorkSlotType>("agent");
  const [isActive, setIsActive] = useState(true);
  const [location, setLocation] = useState<WorkSlotsLocationValues>(emptyLocation);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveTerritoryDisplay = useMemo(
    () =>
      createTerritoryLabelResolver({
        zones: clientRefs?.zones,
        region_options: clientRefs?.region_options,
        city_options: clientRefs?.city_options,
        city_territory_hints: clientRefs?.city_territory_hints,
        territory_nodes: territoryNodes
      }),
    [clientRefs, territoryNodes]
  );

  const territoryCascade = useMemo(() => {
    const mapOpts = (opts: RefSelectOption[]): RefSelectOption[] =>
      opts.map((o) => ({
        value: o.value,
        label: resolveTerritoryDisplay(o.value)
      }));

    const raw = buildZoneRegionCityCascadeOptions(clientRefs, undefined, territoryNodes, {
      zone: location.territoryZone,
      region: location.territoryOblast,
      city: location.territoryCity
    });
    return {
      zones: mapOpts(raw.zones),
      regions: mapOpts(raw.regions),
      cities: mapOpts(raw.cities)
    };
  }, [clientRefs, territoryNodes, location, resolveTerritoryDisplay]);

  useEffect(() => {
    if (!open || !slotId || !tenant) return;
    setLoading(true);
    setError(null);
    void apiFetch<{ data: WorkSlotListItem }>(`/api/${tenant}/work-slots/${slotId}`)
      .then((res) => {
        const d = res.data;
        setOriginal(d);
        setSlotCode(d.slot_code ?? "");
        setLabel(d.label ?? "");
        setBranchCode(d.branch_code ?? "");
        setSlotType(d.slot_type as WorkSlotType);
        setIsActive(d.is_active);
        setLocation({
          territoryZone: d.active_territory_zone ?? "",
          territoryOblast: d.active_territory_oblast ?? "",
          territoryCity: d.active_territory_city ?? "",
          territoryZoneList: [],
          territoryOblastList: [],
          territoryCityList: [],
          warehouseId: d.active_warehouse_id,
          cashDeskId: d.active_cash_desk_id
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [open, slotId, tenant]);

  const submit = async () => {
    if (!slotId || !original) return;
    const code = slotCode.trim().toUpperCase();
    if (!code) {
      setError("Smart-код обязателен");
      return;
    }
    if (!/^[A-Z0-9-]{1,32}$/.test(code)) {
      setError("Код: буквы, цифры или дефис (1–32)");
      return;
    }

    const changes: Record<string, unknown> = {};
    const l = label.trim() || null;
    const b = branchCode.trim() || null;
    if (l !== (original.label ?? null)) changes.label = l;
    if (b !== (original.branch_code ?? null)) changes.branch_code = b;
    if (slotType !== original.slot_type) changes.slot_type = slotType;
    if (isActive !== original.is_active) changes.is_active = isActive;

    const origLoc: WorkSlotsLocationValues = {
      territoryZone: original.active_territory_zone ?? "",
      territoryOblast: original.active_territory_oblast ?? "",
      territoryCity: original.active_territory_city ?? "",
      territoryZoneList: [],
      territoryOblastList: [],
      territoryCityList: [],
      warehouseId: original.active_warehouse_id,
      cashDeskId: original.active_cash_desk_id
    };

    if (location.territoryZone !== origLoc.territoryZone) {
      changes.territory_zone = location.territoryZone.trim() || null;
    }
    if (location.territoryOblast !== origLoc.territoryOblast) {
      changes.territory_oblast = location.territoryOblast.trim() || null;
    }
    if (location.territoryCity !== origLoc.territoryCity) {
      changes.territory_city = location.territoryCity.trim() || null;
    }
    if (location.warehouseId !== origLoc.warehouseId) {
      changes.warehouse_id = location.warehouseId;
    }
    if (location.cashDeskId !== origLoc.cashDeskId) {
      changes.cash_desk_id = location.cashDeskId;
    }

    const hasUserAttrs =
      changes.territory_zone !== undefined ||
      changes.territory_oblast !== undefined ||
      changes.territory_city !== undefined ||
      changes.warehouse_id !== undefined ||
      changes.cash_desk_id !== undefined;

    if (hasUserAttrs && !original.active_user_id) {
      setError("Нет сотрудника на месте — сначала назначьте сотрудника");
      return;
    }

    if (Object.keys(changes).length === 0) {
      setError("Нет изменений");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/${tenant}/work-slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,920px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b bg-muted/25 px-6 py-4">
          <DialogTitle>Редактирование</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">Загрузка…</p>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-1">
              <Label htmlFor="edit-slot-code">Smart-kod</Label>
              <Input
                id="edit-slot-code"
                value={slotCode}
                readOnly
                disabled
                className="font-mono bg-muted"
                autoComplete="off"
                title="Kod yaratilgandan keyin o‘zgartirilmaydi"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-slot-label">Название</Label>
              <Input id="edit-slot-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Филиал</Label>
              <WorkSlotsMultiSelect
                variant="form"
                multiple={false}
                placeholder="Филиал"
                items={[
                  { id: "__none__", title: "—" },
                  ...branchOptions.map((b) => ({ id: b, title: b }))
                ]}
                selectedValues={branchCode ? [branchCode] : []}
                onChange={(next) => {
                  const v = next[0] ?? "";
                  setBranchCode(v === "__none__" ? "" : v);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Роль</Label>
              <WorkSlotsMultiSelect
                variant="form"
                multiple={false}
                placeholder="Роль"
                items={SLOT_TYPE_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
                selectedValues={[slotType]}
                onChange={(next) => {
                  const v = next[0];
                  if (v) setSlotType(v as WorkSlotType);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Статус места</Label>
              <WorkSlotsMultiSelect
                variant="form"
                multiple={false}
                placeholder="Статус"
                items={SLOT_ACTIVE_STATUS_ITEMS}
                selectedValues={[isActive ? "true" : "false"]}
                onChange={(next) => setIsActive((next[0] ?? "true") === "true")}
              />
            </div>

            <WorkSlotsLocationFields
              mode="edit"
              values={location}
              onChange={(patch) => setLocation((prev) => ({ ...prev, ...patch }))}
              territoryCascade={territoryCascade}
              warehouses={warehouses}
              cashDesks={cashDesks}
              disabled={!original?.active_user_id}
            />
            {!original?.active_user_id ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Территория и привязки доступны после назначения сотрудника.
              </p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DialogFooter className="mx-0 mb-0 shrink-0 gap-3 border-t bg-muted/25 px-6 py-5 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-10 min-h-10 min-w-[6.5rem]"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            className="h-10 min-h-10 min-w-[6.5rem]"
            disabled={saving || loading}
            onClick={() => void submit()}
          >
            {saving ? "…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

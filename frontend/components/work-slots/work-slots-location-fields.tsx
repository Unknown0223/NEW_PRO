"use client";

import { MapPin, Wallet } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { RefSelectOption } from "@/lib/ref-select-options";
import {
  WorkSlotsMultiSelect,
  entitiesToItems,
  refOptionsToItems
} from "./work-slots-multi-select";
import { WorkSlotsBulkField, type BulkFieldMode } from "./work-slots-bulk-field";

export type WorkSlotsLocationValues = {
  territoryZone: string;
  territoryOblast: string;
  territoryCity: string;
  /** Guruhli qayta ishlash: zona / viloyat / shahar — ko‘p tanlov */
  territoryZoneList: string[];
  territoryOblastList: string[];
  territoryCityList: string[];
  warehouseId: number | null;
  cashDeskId: number | null;
};

export type WorkSlotsLocationBulkModes = {
  territoryZone: BulkFieldMode;
  territoryOblast: BulkFieldMode;
  territoryCity: BulkFieldMode;
  warehouseId: BulkFieldMode;
  cashDeskId: BulkFieldMode;
};

export const EMPTY_LOCATION_BULK_MODES = (): WorkSlotsLocationBulkModes => ({
  territoryZone: "keep",
  territoryOblast: "keep",
  territoryCity: "keep",
  warehouseId: "keep",
  cashDeskId: "keep"
});

type PickerOpt = { id: number; name: string };

type Props = {
  mode: "edit" | "bulk";
  values: WorkSlotsLocationValues;
  onChange: (patch: Partial<WorkSlotsLocationValues>) => void;
  territoryCascade: {
    zones: RefSelectOption[];
    regions: RefSelectOption[];
    cities: RefSelectOption[];
  };
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
  bulkModes?: WorkSlotsLocationBulkModes;
  onBulkModesChange?: (patch: Partial<WorkSlotsLocationBulkModes>) => void;
  /** Guruhli qayta ishlash: faqat territoriya yoki faqat ombor/kassa */
  bulkSection?: "territory" | "bindings";
  disabled?: boolean;
};

function trimCodes(list: string[]): string[] {
  return list.map((s) => s.trim()).filter(Boolean);
}

function applyTerritoryBulkField(
  body: Record<string, unknown>,
  mode: BulkFieldMode,
  list: string[],
  singleKey: "territory_zone" | "territory_oblast" | "territory_city",
  multiKey: "territory_zones" | "territory_oblasts" | "territory_cities"
) {
  if (mode === "clear") {
    body[singleKey] = null;
    return;
  }
  if (mode !== "set") return;
  const codes = trimCodes(list);
  if (codes.length === 1) body[singleKey] = codes[0]!;
  else if (codes.length > 1) body[multiKey] = codes;
}

export function buildTerritoryPatchFromBulk(
  values: WorkSlotsLocationValues,
  modes: WorkSlotsLocationBulkModes
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  applyTerritoryBulkField(
    body,
    modes.territoryZone,
    values.territoryZoneList,
    "territory_zone",
    "territory_zones"
  );
  applyTerritoryBulkField(
    body,
    modes.territoryOblast,
    values.territoryOblastList,
    "territory_oblast",
    "territory_oblasts"
  );
  applyTerritoryBulkField(
    body,
    modes.territoryCity,
    values.territoryCityList,
    "territory_city",
    "territory_cities"
  );
  return body;
}

export function buildBindingsPatchFromBulk(
  values: WorkSlotsLocationValues,
  modes: WorkSlotsLocationBulkModes
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (modes.warehouseId === "clear") body.warehouse_id = null;
  else if (modes.warehouseId === "set") body.warehouse_id = values.warehouseId;
  if (modes.cashDeskId === "clear") body.cash_desk_id = null;
  else if (modes.cashDeskId === "set") body.cash_desk_id = values.cashDeskId;
  return body;
}

export function validateBulkTerritorySet(
  values: WorkSlotsLocationValues,
  modes: WorkSlotsLocationBulkModes
): string | null {
  if (modes.territoryZone === "set" && trimCodes(values.territoryZoneList).length === 0) {
    return "Зона: выберите хотя бы одно значение";
  }
  if (modes.territoryOblast === "set" && trimCodes(values.territoryOblastList).length === 0) {
    return "Область: выберите хотя бы одно значение";
  }
  if (modes.territoryCity === "set" && trimCodes(values.territoryCityList).length === 0) {
    return "Город: выберите хотя бы одно значение";
  }
  return null;
}

export function validateBulkBindingsSet(
  values: WorkSlotsLocationValues,
  modes: WorkSlotsLocationBulkModes
): string | null {
  if (modes.warehouseId === "set" && values.warehouseId == null) {
    return "Склад: выберите значение";
  }
  if (modes.cashDeskId === "set" && values.cashDeskId == null) {
    return "Касса: выберите значение";
  }
  return null;
}

export function countBulkTerritoryChanges(modes: WorkSlotsLocationBulkModes): number {
  return [modes.territoryZone, modes.territoryOblast, modes.territoryCity].filter(
    (m) => m !== "keep"
  ).length;
}

export function countBulkBindingsChanges(modes: WorkSlotsLocationBulkModes): number {
  return [modes.warehouseId, modes.cashDeskId].filter((m) => m !== "keep").length;
}

export function WorkSlotsLocationFields({
  mode,
  values,
  onChange,
  territoryCascade,
  warehouses,
  cashDesks,
  bulkModes,
  onBulkModesChange,
  bulkSection = "territory",
  disabled
}: Props) {
  if (mode === "bulk" && bulkModes && onBulkModesChange) {
    const setMode = (key: keyof WorkSlotsLocationBulkModes, m: BulkFieldMode) =>
      onBulkModesChange({ [key]: m });

    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Изменения применяются к{" "}
          <span className="font-medium text-foreground">сотруднику на выбранном месте</span>
          {bulkSection === "territory"
            ? " (зона, область, город в профиле)"
            : " (склад и касса в профиле)"}
          . Места без сотрудника будут пропущены.
        </div>

        {bulkSection === "territory" ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              Территория
            </div>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Несколько значений в зоне, области или городе распределяются по выбранным местам
                по очереди.
              </p>
              <WorkSlotsBulkField
                label="Зона"
                mode={bulkModes.territoryZone}
                onModeChange={(m) => setMode("territoryZone", m)}
                disabled={disabled}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  placeholder="Зона"
                  items={refOptionsToItems(territoryCascade.zones)}
                  selectedValues={values.territoryZoneList}
                  onChange={(territoryZoneList) => onChange({ territoryZoneList })}
                  disabled={disabled}
                />
              </WorkSlotsBulkField>
              <WorkSlotsBulkField
                label="Область"
                mode={bulkModes.territoryOblast}
                onModeChange={(m) => setMode("territoryOblast", m)}
                disabled={disabled}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  placeholder="Область"
                  items={refOptionsToItems(territoryCascade.regions)}
                  selectedValues={values.territoryOblastList}
                  onChange={(territoryOblastList) => onChange({ territoryOblastList })}
                  disabled={disabled}
                />
              </WorkSlotsBulkField>
              <WorkSlotsBulkField
                label="Город"
                mode={bulkModes.territoryCity}
                onModeChange={(m) => setMode("territoryCity", m)}
                disabled={disabled}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  placeholder="Город"
                  items={refOptionsToItems(territoryCascade.cities)}
                  selectedValues={values.territoryCityList}
                  onChange={(territoryCityList) => onChange({ territoryCityList })}
                  disabled={disabled}
                />
              </WorkSlotsBulkField>
            </div>
          </section>
        ) : null}

        {bulkSection === "bindings" ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Wallet className="size-3.5 shrink-0" aria-hidden />
              Привязки
            </div>
            <div className="space-y-3">
              <WorkSlotsBulkField
                label="Склад"
                mode={bulkModes.warehouseId}
                onModeChange={(m) => setMode("warehouseId", m)}
                disabled={disabled}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  multiple={false}
                  placeholder="Склад"
                  items={entitiesToItems(warehouses)}
                  selectedValues={values.warehouseId != null ? [String(values.warehouseId)] : []}
                  onChange={(next) => {
                    const last = next[0];
                    onChange({
                      warehouseId: last != null && last !== "" ? Number.parseInt(last, 10) : null
                    });
                  }}
                  disabled={disabled}
                />
              </WorkSlotsBulkField>
              <WorkSlotsBulkField
                label="Касса"
                mode={bulkModes.cashDeskId}
                onModeChange={(m) => setMode("cashDeskId", m)}
                disabled={disabled}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  multiple={false}
                  placeholder="Касса"
                  items={entitiesToItems(cashDesks)}
                  selectedValues={values.cashDeskId != null ? [String(values.cashDeskId)] : []}
                  onChange={(next) => {
                    const last = next[0];
                    onChange({
                      cashDeskId: last != null && last !== "" ? Number.parseInt(last, 10) : null
                    });
                  }}
                  disabled={disabled}
                />
              </WorkSlotsBulkField>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          Территория
        </div>
        <p className="text-xs text-muted-foreground">Зона, область и город сотрудника на месте.</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Зона</Label>
            <WorkSlotsMultiSelect
              variant="form"
              multiple={false}
              placeholder="Зона"
              items={refOptionsToItems(territoryCascade.zones)}
              selectedValues={values.territoryZone ? [values.territoryZone] : []}
              onChange={(next) =>
                onChange({
                  territoryZone: next[0] ?? "",
                  territoryOblast: "",
                  territoryCity: ""
                })
              }
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Область</Label>
            <WorkSlotsMultiSelect
              variant="form"
              multiple={false}
              placeholder="Область"
              items={refOptionsToItems(territoryCascade.regions)}
              selectedValues={values.territoryOblast ? [values.territoryOblast] : []}
              onChange={(next) =>
                onChange({ territoryOblast: next[0] ?? "", territoryCity: "" })
              }
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Город</Label>
            <WorkSlotsMultiSelect
              variant="form"
              multiple={false}
              placeholder="Город"
              items={refOptionsToItems(territoryCascade.cities)}
              selectedValues={values.territoryCity ? [values.territoryCity] : []}
              onChange={(next) => onChange({ territoryCity: next[0] ?? "" })}
              disabled={disabled}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Wallet className="size-3.5 shrink-0" aria-hidden />
          Привязки
        </div>
        <p className="text-xs text-muted-foreground">Склад и касса сотрудника на месте.</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Склад</Label>
            <WorkSlotsMultiSelect
              variant="form"
              multiple={false}
              placeholder="Склад"
              items={entitiesToItems(warehouses)}
              selectedValues={values.warehouseId != null ? [String(values.warehouseId)] : []}
              onChange={(next) => {
                const last = next[0];
                onChange({
                  warehouseId: last != null && last !== "" ? Number.parseInt(last, 10) : null
                });
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Касса</Label>
            <WorkSlotsMultiSelect
              variant="form"
              multiple={false}
              placeholder="Касса"
              items={entitiesToItems(cashDesks)}
              selectedValues={values.cashDeskId != null ? [String(values.cashDeskId)] : []}
              onChange={(next) => {
                const last = next[0];
                onChange({
                  cashDeskId: last != null && last !== "" ? Number.parseInt(last, 10) : null
                });
              }}
              disabled={disabled}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

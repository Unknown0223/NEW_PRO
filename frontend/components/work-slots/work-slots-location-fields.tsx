"use client";

import { MapPin, Wallet } from "lucide-react";
import type { CityTerritoryHint } from "@/lib/city-territory-hint";
import type { RefSelectOption } from "@/lib/ref-select-options";
import {
  WorkSlotsMultiSelect,
  entitiesToItems
} from "./work-slots-multi-select";
import { WorkSlotsBulkField, type BulkFieldMode } from "./work-slots-bulk-field";
import {
  WorkSlotsTerritoryBulkPicker,
  WorkSlotsTerritoryCascadePicker
} from "./work-slots-territory-cascade-picker";

export type WorkSlotsLocationValues = {
  territoryZone: string;
  territoryOblast: string;
  territoryCity: string;
  /** Guruhli qayta ishlash: zona / viloyat / shahar — ko‘p tanlov */
  territoryZoneList: string[];
  territoryOblastList: string[];
  territoryCityList: string[];
  warehouseId: number | null;
  returnWarehouseId: number | null;
  cashDeskId: number | null;
};

export type WorkSlotsLocationBulkModes = {
  territoryZone: BulkFieldMode;
  territoryOblast: BulkFieldMode;
  territoryCity: BulkFieldMode;
  warehouseId: BulkFieldMode;
  returnWarehouseId: BulkFieldMode;
  cashDeskId: BulkFieldMode;
};

export const EMPTY_LOCATION_BULK_MODES = (): WorkSlotsLocationBulkModes => ({
  territoryZone: "keep",
  territoryOblast: "keep",
  territoryCity: "keep",
  warehouseId: "keep",
  returnWarehouseId: "keep",
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
  cityTerritoryHints?: Record<string, CityTerritoryHint>;
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
  bulkModes?: WorkSlotsLocationBulkModes;
  onBulkModesChange?: (patch: Partial<WorkSlotsLocationBulkModes>) => void;
  /** Guruhli qayta ishlash: faqat territoriya, faqat ombor/kassa yoki ikkalasi */
  bulkSection?: "territory" | "bindings" | "all";
  /** Guruhli: qaysi bog‘lanish maydonlari ko‘rinsin */
  bulkBindingFields?: Array<"warehouse" | "return_warehouse" | "cash_desk">;
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
  if (modes.returnWarehouseId === "clear") body.return_warehouse_id = null;
  else if (modes.returnWarehouseId === "set") body.return_warehouse_id = values.returnWarehouseId;
  if (modes.cashDeskId === "clear") body.cash_desk_id = null;
  else if (modes.cashDeskId === "set") body.cash_desk_id = values.cashDeskId;
  return body;
}

export function buildWorkplacePatchFromBulk(
  values: WorkSlotsLocationValues,
  modes: WorkSlotsLocationBulkModes
): Record<string, unknown> {
  return {
    ...buildTerritoryPatchFromBulk(values, modes),
    ...buildBindingsPatchFromBulk(values, modes)
  };
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
  if (modes.returnWarehouseId === "set" && values.returnWarehouseId == null) {
    return "Склад возврата: выберите значение";
  }
  if (modes.cashDeskId === "set" && values.cashDeskId == null) {
    return "Касса: выберите значение";
  }
  return null;
}

export function validateBulkWorkplaceSet(
  values: WorkSlotsLocationValues,
  modes: WorkSlotsLocationBulkModes
): string | null {
  return validateBulkTerritorySet(values, modes) ?? validateBulkBindingsSet(values, modes);
}

export function countBulkTerritoryChanges(modes: WorkSlotsLocationBulkModes): number {
  return [modes.territoryZone, modes.territoryOblast, modes.territoryCity].filter(
    (m) => m !== "keep"
  ).length;
}

export function countBulkBindingsChanges(modes: WorkSlotsLocationBulkModes): number {
  return [modes.warehouseId, modes.returnWarehouseId, modes.cashDeskId].filter((m) => m !== "keep").length;
}

export function countBulkWorkplaceChanges(modes: WorkSlotsLocationBulkModes): number {
  return countBulkTerritoryChanges(modes) + countBulkBindingsChanges(modes);
}

function combinedTerritoryMode(modes: WorkSlotsLocationBulkModes): BulkFieldMode {
  const vals = [modes.territoryZone, modes.territoryOblast, modes.territoryCity];
  if (vals.every((m) => m === "clear")) return "clear";
  if (vals.some((m) => m === "set")) return "set";
  if (vals.some((m) => m === "clear")) return "clear";
  return "keep";
}

function setCombinedTerritoryMode(
  onBulkModesChange: (patch: Partial<WorkSlotsLocationBulkModes>) => void,
  mode: BulkFieldMode
) {
  onBulkModesChange({
    territoryZone: mode,
    territoryOblast: mode,
    territoryCity: mode
  });
}

export function WorkSlotsLocationFields({
  mode,
  values,
  onChange,
  territoryCascade,
  cityTerritoryHints,
  warehouses,
  cashDesks,
  bulkModes,
  onBulkModesChange,
  bulkSection = "territory",
  bulkBindingFields = ["warehouse", "cash_desk"],
  disabled
}: Props) {
  if (mode === "bulk" && bulkModes && onBulkModesChange) {
    const setMode = (key: keyof WorkSlotsLocationBulkModes, m: BulkFieldMode) =>
      onBulkModesChange({ [key]: m });

    const showTerritory = bulkSection === "territory" || bulkSection === "all";
    const showBindings = bulkSection === "bindings" || bulkSection === "all";
    const showWarehouse = showBindings && bulkBindingFields.includes("warehouse");
    const showReturnWarehouse = showBindings && bulkBindingFields.includes("return_warehouse");
    const showCashDesk = showBindings && bulkBindingFields.includes("cash_desk");
    const territoryMode = combinedTerritoryMode(bulkModes);

    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Изменения применяются к{" "}
          <span className="font-medium text-foreground">сотруднику на выбранном месте</span>
          {bulkSection === "all"
            ? " (территория, склад и касса)"
            : bulkSection === "territory"
              ? " (зона, область, город)"
              : " (склад, возврат и касса)"}
          . Места без сотрудника для территории/склада/кассы всё равно обновятся на уровне места.
        </div>

        {showTerritory ? (
          <section className="space-y-3">
            <WorkSlotsBulkField
              label="Территория (зона → область → город)"
              mode={territoryMode}
              onModeChange={(m) => setCombinedTerritoryMode(onBulkModesChange, m)}
              disabled={disabled}
            >
              <WorkSlotsTerritoryBulkPicker
                zoneList={values.territoryZoneList}
                regionList={values.territoryOblastList}
                cityList={values.territoryCityList}
                onZoneListChange={(territoryZoneList) => onChange({ territoryZoneList })}
                onRegionListChange={(territoryOblastList) => onChange({ territoryOblastList })}
                onCityListChange={(territoryCityList) => onChange({ territoryCityList })}
                cascade={territoryCascade}
                disabled={disabled}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Несколько значений распределяются по выбранным местам по очереди.
              </p>
            </WorkSlotsBulkField>
          </section>
        ) : null}

        {showBindings ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Wallet className="size-3.5 shrink-0" aria-hidden />
              Привязки
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {showWarehouse ? (
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
              ) : null}
              {showReturnWarehouse ? (
              <WorkSlotsBulkField
                label="Склад возврата"
                mode={bulkModes.returnWarehouseId}
                onModeChange={(m) => setMode("returnWarehouseId", m)}
                disabled={disabled}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  multiple={false}
                  placeholder="Склад возврата"
                  items={entitiesToItems(warehouses)}
                  selectedValues={
                    values.returnWarehouseId != null ? [String(values.returnWarehouseId)] : []
                  }
                  onChange={(next) => {
                    const last = next[0];
                    onChange({
                      returnWarehouseId:
                        last != null && last !== "" ? Number.parseInt(last, 10) : null
                    });
                  }}
                  disabled={disabled}
                />
              </WorkSlotsBulkField>
              ) : null}
              {showCashDesk ? (
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
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WorkSlotsTerritoryCascadePicker
        values={{
          zone: values.territoryZone,
          region: values.territoryOblast,
          city: values.territoryCity
        }}
        onChange={(patch) =>
          onChange({
            ...(patch.zone !== undefined ? { territoryZone: patch.zone } : {}),
            ...(patch.region !== undefined ? { territoryOblast: patch.region } : {}),
            ...(patch.city !== undefined ? { territoryCity: patch.city } : {})
          })
        }
        cascade={territoryCascade}
        cityTerritoryHints={cityTerritoryHints}
        disabled={disabled}
      />

      <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Wallet className="size-3.5 shrink-0" aria-hidden />
          Привязки
        </div>
        <p className="text-xs text-muted-foreground">Склад и касса сотрудника на месте.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Склад
            </span>
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
            <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Касса
            </span>
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

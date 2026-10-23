"use client";

import { Wallet } from "lucide-react";
import type { CityTerritoryHint } from "@/lib/city-territory-hint";
import type { RefSelectOption } from "@/lib/ref-select-options";
import type { TerritoryNode } from "@/lib/territory-tree";
import {
  WorkSlotsMultiSelect,
  entitiesToItems
} from "./work-slots-multi-select";
import { WorkSlotsBulkField, type BulkFieldMode } from "./work-slots-bulk-field";
import {
  WorkSlotsTerritoryBulkPicker
} from "./work-slots-territory-cascade-picker";

export type WorkSlotsLocationValues = {
  territoryZone: string;
  territoryOblast: string;
  territoryCity: string;
  /** Guruhli / multi: zona / viloyat / shahar — ko‘p tanlov */
  territoryZoneList: string[];
  territoryOblastList: string[];
  territoryCityList: string[];
  /** Birinchi ombor — compat; asosiy qiymat warehouseIds */
  warehouseId: number | null;
  warehouseIds: number[];
  returnWarehouseId: number | null;
  cashDeskId: number | null;
  cashDeskIds: number[];
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

export const emptyLocationValues = (): WorkSlotsLocationValues => ({
  territoryZone: "",
  territoryOblast: "",
  territoryCity: "",
  territoryZoneList: [],
  territoryOblastList: [],
  territoryCityList: [],
  warehouseId: null,
  warehouseIds: [],
  returnWarehouseId: null,
  cashDeskId: null,
  cashDeskIds: []
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
  /** Bulk: zona/oblast tanlanganda pastki darajalarni avtomatik belgilash */
  territoryNodes?: TerritoryNode[];
  cityTerritoryHints?: Record<string, CityTerritoryHint>;
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
  bulkModes?: WorkSlotsLocationBulkModes;
  onBulkModesChange?: (patch: Partial<WorkSlotsLocationBulkModes>) => void;
  /** Guruhli qayta ishlash: faqat territoriya, faqat ombor/kassa yoki ikkalasi */
  bulkSection?: "territory" | "bindings" | "all";
  /** Qaysi bog‘lanish maydonlari ko‘rinsin (edit + bulk) */
  bulkBindingFields?: Array<"warehouse" | "return_warehouse" | "cash_desk">;
  /** Edit rejimida territoriya bloki */
  showTerritory?: boolean;
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
  // Har doim multi — backend daraxt bilan zona/oblast/gorod yig‘adi (singular merge chalkashmasin).
  if (codes.length >= 1) body[multiKey] = codes;
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
  if (modes.warehouseId === "clear") {
    body.warehouse_id = null;
    body.warehouse_ids = [];
  } else if (modes.warehouseId === "set") {
    const ids =
      values.warehouseIds.length > 0
        ? values.warehouseIds
        : values.warehouseId != null
          ? [values.warehouseId]
          : [];
    body.warehouse_ids = ids;
    body.warehouse_id = ids[0] ?? null;
  }
  if (modes.returnWarehouseId === "clear") body.return_warehouse_id = null;
  else if (modes.returnWarehouseId === "set") body.return_warehouse_id = values.returnWarehouseId;
  if (modes.cashDeskId === "clear") {
    body.cash_desk_id = null;
    body.cash_desk_ids = [];
  } else if (modes.cashDeskId === "set") {
    const ids =
      values.cashDeskIds.length > 0
        ? values.cashDeskIds
        : values.cashDeskId != null
          ? [values.cashDeskId]
          : [];
    body.cash_desk_ids = ids;
    body.cash_desk_id = ids[0] ?? null;
  }
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
  const anySet =
    modes.territoryZone === "set" ||
    modes.territoryOblast === "set" ||
    modes.territoryCity === "set";
  if (!anySet) return null;

  const hasAny =
    trimCodes(values.territoryZoneList).length > 0 ||
    trimCodes(values.territoryOblastList).length > 0 ||
    trimCodes(values.territoryCityList).length > 0;

  // Zona yoki oblast yetarli — shahar hech qachon majburiy emas.
  if (hasAny) return null;
  return "Территория: выберите хотя бы зону, область или город";
}

export function validateBulkBindingsSet(
  values: WorkSlotsLocationValues,
  modes: WorkSlotsLocationBulkModes
): string | null {
  if (
    modes.warehouseId === "set" &&
    values.warehouseIds.length === 0 &&
    values.warehouseId == null
  ) {
    return "Склад: выберите значение";
  }
  if (modes.returnWarehouseId === "set" && values.returnWarehouseId == null) {
    return "Склад возврата: выберите значение";
  }
  if (
    modes.cashDeskId === "set" &&
    values.cashDeskIds.length === 0 &&
    values.cashDeskId == null
  ) {
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

function parseIdList(next: string[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of next) {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function WorkSlotsLocationFields({
  mode,
  values,
  onChange,
  territoryCascade,
  territoryNodes,
  cityTerritoryHints,
  warehouses,
  cashDesks,
  bulkModes,
  onBulkModesChange,
  bulkSection = "territory",
  bulkBindingFields = ["warehouse", "cash_desk"],
  showTerritory = true,
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
                onCascadeListsChange={(patch) => onChange(patch)}
                cascade={territoryCascade}
                territoryNodes={territoryNodes}
                cityTerritoryHints={cityTerritoryHints}
                disabled={disabled}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Несколько зон/областей/городов сохраняются на каждое выбранное место (полный список).
                Город необязателен.
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
                  multiple={true}
                  placeholder="Склады"
                  items={entitiesToItems(warehouses)}
                  selectedValues={(values.warehouseIds.length
                    ? values.warehouseIds
                    : values.warehouseId != null
                      ? [values.warehouseId]
                      : []
                  ).map(String)}
                  onChange={(next) => {
                    const warehouseIds = parseIdList(next);
                    onChange({
                      warehouseIds,
                      warehouseId: warehouseIds[0] ?? null
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
                  multiple={true}
                  placeholder="Кассы"
                  items={entitiesToItems(cashDesks)}
                  selectedValues={(values.cashDeskIds.length
                    ? values.cashDeskIds
                    : values.cashDeskId != null
                      ? [values.cashDeskId]
                      : []
                  ).map(String)}
                  onChange={(next) => {
                    const cashDeskIds = parseIdList(next);
                    onChange({
                      cashDeskIds,
                      cashDeskId: cashDeskIds[0] ?? null
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

  const editWarehouseIds =
    values.warehouseIds.length > 0
      ? values.warehouseIds
      : values.warehouseId != null
        ? [values.warehouseId]
        : [];
  const editCashDeskIds =
    values.cashDeskIds.length > 0
      ? values.cashDeskIds
      : values.cashDeskId != null
        ? [values.cashDeskId]
        : [];
  const showWarehouse = bulkBindingFields.includes("warehouse");
  const showReturnWarehouse = bulkBindingFields.includes("return_warehouse");
  const showCashDesk = bulkBindingFields.includes("cash_desk");
  const showBindings = showWarehouse || showReturnWarehouse || showCashDesk;

  return (
    <div className="space-y-4">
      {showTerritory ? (
        <section className="space-y-2">
          <WorkSlotsTerritoryBulkPicker
            zoneList={
              values.territoryZoneList.length
                ? values.territoryZoneList
                : values.territoryZone
                  ? [values.territoryZone]
                  : []
            }
            regionList={
              values.territoryOblastList.length
                ? values.territoryOblastList
                : values.territoryOblast
                  ? [values.territoryOblast]
                  : []
            }
            cityList={
              values.territoryCityList.length
                ? values.territoryCityList
                : values.territoryCity
                  ? [values.territoryCity]
                  : []
            }
            onZoneListChange={(territoryZoneList) =>
              onChange({
                territoryZoneList,
                territoryZone: territoryZoneList[0] ?? ""
              })
            }
            onRegionListChange={(territoryOblastList) =>
              onChange({
                territoryOblastList,
                territoryOblast: territoryOblastList[0] ?? ""
              })
            }
            onCityListChange={(territoryCityList) =>
              onChange({
                territoryCityList,
                territoryCity: territoryCityList[0] ?? ""
              })
            }
            onCascadeListsChange={(patch) =>
              onChange({
                ...patch,
                territoryZone:
                  patch.territoryZoneList !== undefined
                    ? (patch.territoryZoneList[0] ?? "")
                    : values.territoryZone,
                territoryOblast:
                  patch.territoryOblastList !== undefined
                    ? (patch.territoryOblastList[0] ?? "")
                    : values.territoryOblast,
                territoryCity:
                  patch.territoryCityList !== undefined
                    ? (patch.territoryCityList[0] ?? "")
                    : values.territoryCity
              })
            }
            cascade={territoryCascade}
            territoryNodes={territoryNodes}
            cityTerritoryHints={cityTerritoryHints}
            disabled={disabled}
          />
          <p className="text-[11px] text-muted-foreground">
            Можно выбрать несколько территорий — все сохранятся на этом месте.
          </p>
        </section>
      ) : null}

      {showBindings ? (
        <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Wallet className="size-3.5 shrink-0" aria-hidden />
            Привязки
          </div>
          <p className="text-xs text-muted-foreground">
            Склады и кассы сотрудника на месте (несколько).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {showWarehouse ? (
              <div className="space-y-1">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Склад
                </span>
                <WorkSlotsMultiSelect
                  variant="form"
                  multiple={true}
                  placeholder="Склады"
                  items={entitiesToItems(warehouses)}
                  selectedValues={editWarehouseIds.map(String)}
                  onChange={(next) => {
                    const warehouseIds = parseIdList(next);
                    onChange({
                      warehouseIds,
                      warehouseId: warehouseIds[0] ?? null
                    });
                  }}
                  disabled={disabled}
                />
              </div>
            ) : null}
            {showReturnWarehouse ? (
              <div className="space-y-1">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Склад возврата
                </span>
                <WorkSlotsMultiSelect
                  variant="form"
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
              </div>
            ) : null}
            {showCashDesk ? (
              <div className="space-y-1">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Касса
                </span>
                <WorkSlotsMultiSelect
                  variant="form"
                  multiple={true}
                  placeholder="Кассы"
                  items={entitiesToItems(cashDesks)}
                  selectedValues={editCashDeskIds.map(String)}
                  onChange={(next) => {
                    const cashDeskIds = parseIdList(next);
                    onChange({
                      cashDeskIds,
                      cashDeskId: cashDeskIds[0] ?? null
                    });
                  }}
                  disabled={disabled}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

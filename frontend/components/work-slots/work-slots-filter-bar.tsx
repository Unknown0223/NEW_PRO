"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterSelectClassName } from "@/components/ui/filter-select";
import type { WorkSlotType } from "@/lib/work-slots-types";
import type { RefSelectOption } from "@/lib/ref-select-options";
import {
  WorkSlotsMultiSelect,
  entitiesToItems,
  refOptionsToItems
} from "./work-slots-multi-select";
import { SLOT_TYPE_OPTIONS } from "./work-slots-utils";

export type WorkSlotsFilterState = {
  search: string;
  branchList: string[];
  directionIdList: string[];
  territoryZoneList: string[];
  territoryOblastList: string[];
  territoryCityList: string[];
  warehouseIdList: string[];
  cashDeskIdList: string[];
  slotType: WorkSlotType;
  activeStatusList: string[];
};

type PickerOpt = { id: number; name: string };

type Props = {
  draft: WorkSlotsFilterState;
  onDraftChange: (next: WorkSlotsFilterState) => void;
  /** Rol — darhol qo‘llanadi (Применить kutmasdan) */
  onSlotTypeChange?: (slotType: WorkSlotType) => void;
  appliedSlotType?: WorkSlotType;
  onReset?: () => void;
  onApply?: () => void;
  branches: string[];
  directions: PickerOpt[];
  territoryCascade: { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] };
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
};

const FIELD_ROLE_VALUES = new Set([
  "agent",
  "collector",
  "expeditor",
  "skladchik",
  "supervisor",
  "auditor"
]);

const compactFilterTrigger = cn(
  filterSelectClassName,
  "h-8 max-w-none text-xs font-normal shadow-sm"
);

export function WorkSlotsFilterBar({
  draft,
  onDraftChange,
  onSlotTypeChange,
  appliedSlotType,
  onReset,
  onApply,
  branches,
  directions,
  territoryCascade,
  warehouses,
  cashDesks
}: Props) {
  const set = (patch: Partial<WorkSlotsFilterState>) => onDraftChange({ ...draft, ...patch });
  const activeSlotType = appliedSlotType ?? draft.slotType;

  const applySlotType = (value: WorkSlotType) => {
    if (onSlotTypeChange) onSlotTypeChange(value);
    else set({ slotType: value });
  };

  const fieldRoles = SLOT_TYPE_OPTIONS.filter((o) => FIELD_ROLE_VALUES.has(o.value));
  const officeRoles = SLOT_TYPE_OPTIONS.filter((o) => !FIELD_ROLE_VALUES.has(o.value));

  const roleChip = (o: (typeof SLOT_TYPE_OPTIONS)[number]) => {
    const active = activeSlotType === o.value;
    return (
      <button
        key={o.value}
        type="button"
        className={cn(
          "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          active
            ? "bg-teal-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-white hover:text-slate-900"
        )}
        onClick={() => applySlotType(o.value)}
      >
        {o.label}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2">
        <WorkSlotsMultiSelect
          variant="filter-compact"
          triggerClassName={compactFilterTrigger}
          placeholder="Филиал"
          items={branches.map((b) => ({ id: b, title: b }))}
          selectedValues={draft.branchList}
          onChange={(branchList) => set({ branchList })}
        />
        <WorkSlotsMultiSelect
          variant="filter-compact"
          triggerClassName={compactFilterTrigger}
          placeholder="Направление"
          items={entitiesToItems(directions)}
          selectedValues={draft.directionIdList}
          onChange={(directionIdList) => set({ directionIdList })}
        />
        <WorkSlotsMultiSelect
          variant="filter-compact"
          triggerClassName={compactFilterTrigger}
          placeholder="Склад"
          items={entitiesToItems(warehouses)}
          selectedValues={draft.warehouseIdList}
          onChange={(warehouseIdList) => set({ warehouseIdList })}
        />
        <WorkSlotsMultiSelect
          variant="filter-compact"
          triggerClassName={compactFilterTrigger}
          placeholder="Касса"
          items={entitiesToItems(cashDesks)}
          selectedValues={draft.cashDeskIdList}
          onChange={(cashDeskIdList) => set({ cashDeskIdList })}
        />
        <WorkSlotsMultiSelect
          variant="filter-compact"
          triggerClassName={compactFilterTrigger}
          placeholder="Зона"
          items={refOptionsToItems(territoryCascade.zones)}
          selectedValues={draft.territoryZoneList}
          onChange={(territoryZoneList) =>
            set({
              territoryZoneList,
              territoryOblastList: [],
              territoryCityList: []
            })
          }
        />
        <WorkSlotsMultiSelect
          variant="filter-compact"
          triggerClassName={compactFilterTrigger}
          placeholder="Область"
          items={refOptionsToItems(territoryCascade.regions)}
          selectedValues={draft.territoryOblastList}
          onChange={(territoryOblastList) =>
            set({
              territoryOblastList,
              territoryCityList: []
            })
          }
        />
        <WorkSlotsMultiSelect
          variant="filter-compact"
          triggerClassName={compactFilterTrigger}
          placeholder="Город"
          items={refOptionsToItems(territoryCascade.cities)}
          selectedValues={draft.territoryCityList}
          onChange={(territoryCityList) => set({ territoryCityList })}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-slate-500">Роль</span>

          <div className="min-w-0 flex-1 sm:hidden">
            <select
              className={cn(compactFilterTrigger, "w-full")}
              value={activeSlotType}
              aria-label="Роль"
              onChange={(e) => applySlotType(e.target.value as WorkSlotType)}
            >
              <optgroup label="Команда">
                {fieldRoles.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Сотрудники">
                {officeRoles.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div
            className="hidden min-w-0 flex-1 overflow-x-auto sm:block"
            role="group"
            aria-label="Роль"
          >
            <div className="inline-flex min-w-max items-center gap-1 rounded-lg border border-border/80 bg-slate-50/80 p-1">
              {fieldRoles.map(roleChip)}
              <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
              {officeRoles.map(roleChip)}
            </div>
          </div>
        </div>

        {onReset || onApply ? (
          <div className="flex shrink-0 items-center justify-end gap-2 sm:pl-1">
            {onReset ? (
              <button
                type="button"
                onClick={onReset}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-muted"
              >
                <Filter className="h-3.5 w-3.5" />
                Сбросить
              </button>
            ) : null}
            {onApply ? (
              <button
                type="button"
                onClick={onApply}
                className="flex h-8 items-center rounded-lg bg-teal-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
              >
                Применить
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

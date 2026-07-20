"use client";

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
  branches: string[];
  directions: PickerOpt[];
  territoryCascade: { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] };
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
};

/** Grid ichida trigger to‘liq kenglik — max-w-[18rem] bo‘sh «tirqish» qoldirmaydi */
const compactFilterTrigger = cn(
  filterSelectClassName,
  "h-8 max-w-none text-xs font-normal shadow-sm"
);

export function WorkSlotsFilterBar({
  draft,
  onDraftChange,
  branches,
  directions,
  territoryCascade,
  warehouses,
  cashDesks
}: Props) {
  const set = (patch: Partial<WorkSlotsFilterState>) => onDraftChange({ ...draft, ...patch });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-2">
        <span className="shrink-0 text-[11px] text-muted-foreground sm:text-xs">Роль:</span>
        <div
          className="inline-flex min-w-0 flex-wrap gap-0.5 rounded-md border border-border/80 bg-muted/30 p-0.5"
          role="group"
          aria-label="Роль"
        >
          {SLOT_TYPE_OPTIONS.map((o) => {
            const active = draft.slotType === o.value;
            return (
              <button
                key={o.value}
                type="button"
                className={cn(
                  "rounded px-1.5 py-1 text-[10px] font-medium transition-colors sm:px-2 sm:text-xs",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => set({ slotType: o.value })}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkSlotType } from "@/lib/work-slots-types";
import type { RefSelectOption } from "@/lib/ref-select-options";
import {
  WorkSlotsMultiSelect,
  entitiesToItems,
  refOptionsToItems
} from "./work-slots-multi-select";
import { ACTIVE_STATUS_FILTER_ITEMS, SLOT_TYPE_OPTIONS } from "./work-slots-utils";

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
  onApplyPatch: (patch: Partial<WorkSlotsFilterState>) => void;
  branches: string[];
  directions: PickerOpt[];
  territoryCascade: { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] };
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
  onApply: () => void;
  onClear: () => void;
};

/** Moslashuvchan: tor ekranda 2–3 ustun; xl+ da 8 ta filtr bitta qatorga sig‘adi. */
const filterCell =
  "min-w-0 max-w-none flex-1 basis-[calc(50%-0.25rem)] sm:basis-[calc(33.333%-0.34rem)] md:basis-[calc(25%-0.375rem)] lg:basis-[calc(25%-0.375rem)] xl:basis-[calc(12.5%-0.44rem)]";

export function WorkSlotsFilterBar({
  draft,
  onDraftChange,
  onApplyPatch,
  branches,
  directions,
  territoryCascade,
  warehouses,
  cashDesks,
  onApply,
  onClear
}: Props) {
  const set = (patch: Partial<WorkSlotsFilterState>) => onDraftChange({ ...draft, ...patch });

  return (
    <div className="space-y-2 rounded-lg border bg-card p-2.5 shadow-sm sm:p-3">
      <div className="flex flex-wrap items-stretch gap-1.5">
        <div className={filterCell}>
          <WorkSlotsMultiSelect
            variant="filter-compact"
            placeholder="Статус"
            items={ACTIVE_STATUS_FILTER_ITEMS}
            selectedValues={draft.activeStatusList}
            onChange={(activeStatusList) => set({ activeStatusList })}
          />
        </div>

        <div className={filterCell}>
          <WorkSlotsMultiSelect
            variant="filter-compact"
            placeholder="Филиал"
            items={branches.map((b) => ({ id: b, title: b }))}
            selectedValues={draft.branchList}
            onChange={(branchList) => set({ branchList })}
          />
        </div>

        <div className={filterCell}>
          <WorkSlotsMultiSelect
            variant="filter-compact"
            placeholder="Направление"
            items={entitiesToItems(directions)}
            selectedValues={draft.directionIdList}
            onChange={(directionIdList) => set({ directionIdList })}
          />
        </div>

        <div className={filterCell}>
          <WorkSlotsMultiSelect
            variant="filter-compact"
            placeholder="Склад"
            items={entitiesToItems(warehouses)}
            selectedValues={draft.warehouseIdList}
            onChange={(warehouseIdList) => set({ warehouseIdList })}
          />
        </div>

        <div className={filterCell}>
          <WorkSlotsMultiSelect
            variant="filter-compact"
            placeholder="Касса"
            items={entitiesToItems(cashDesks)}
            selectedValues={draft.cashDeskIdList}
            onChange={(cashDeskIdList) => set({ cashDeskIdList })}
          />
        </div>

        <div className={filterCell}>
          <WorkSlotsMultiSelect
            variant="filter-compact"
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
        </div>

        <div className={filterCell}>
          <WorkSlotsMultiSelect
            variant="filter-compact"
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
        </div>

        <div className={filterCell}>
          <WorkSlotsMultiSelect
            variant="filter-compact"
            placeholder="Город"
            items={refOptionsToItems(territoryCascade.cities)}
            selectedValues={draft.territoryCityList}
            onChange={(territoryCityList) => set({ territoryCityList })}
          />
        </div>

      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
        <span className="shrink-0 text-[11px] text-muted-foreground sm:text-xs">Роль:</span>
        <div
          className="inline-flex min-w-0 flex-1 flex-wrap gap-0.5 rounded-md border border-border/80 bg-muted/30 p-0.5"
          role="group"
          aria-label="Роль"
        >
          {SLOT_TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={cn(
                "rounded px-1.5 py-1 text-[10px] font-medium transition-colors sm:px-2 sm:text-xs",
                draft.slotType === o.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onApplyPatch({ slotType: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="Сброс"
            aria-label="Сброс"
            onClick={onClear}
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            title="Применить"
            aria-label="Применить"
            onClick={onApply}
          >
            <Check className="size-3.5 md:hidden" aria-hidden />
            <span className="hidden md:inline">Применить</span>
          </Button>
        </div>
      </div>
    </div>
  );
}


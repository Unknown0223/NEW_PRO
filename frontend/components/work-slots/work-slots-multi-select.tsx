"use client";

import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { cityStoredCodeToDisplayLabel } from "@/lib/city-territory-hint";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { refOptionsToPickerItems } from "@/lib/ref-select-options";
import { cn } from "@/lib/utils";

export type WorkSlotsMultiSelectItem = {
  id: string;
  title: string;
  searchText?: string | null;
};

export type WorkSlotsMultiSelectVariant = "filter" | "filter-compact" | "bulk" | "form";

const VARIANT_PRESETS: Record<
  WorkSlotsMultiSelectVariant,
  { minPopoverWidth: number; maxListHeightClass: string; hidePopoverHeader: boolean; triggerClass: string }
> = {
  filter: {
    minPopoverWidth: 300,
    maxListHeightClass: "max-h-64",
    hidePopoverHeader: false,
    triggerClass: cn(filterSelectClassName, "h-9 w-full min-w-0 text-sm font-normal shadow-sm")
  },
  "filter-compact": {
    minPopoverWidth: 280,
    maxListHeightClass: "max-h-64",
    hidePopoverHeader: false,
    triggerClass: cn(filterSelectClassName, "h-8 w-full min-w-0 text-xs font-normal shadow-sm")
  },
  bulk: {
    minPopoverWidth: 380,
    maxListHeightClass: "max-h-64",
    hidePopoverHeader: false,
    triggerClass: cn(filterSelectClassName, "h-10 w-full text-sm font-normal shadow-sm")
  },
  form: {
    minPopoverWidth: 320,
    maxListHeightClass: "max-h-64",
    hidePopoverHeader: false,
    triggerClass: cn(filterSelectClassName, "h-10 w-full text-sm font-normal shadow-sm")
  }
};

export function refOptionsToItems(opts: RefSelectOption[]): WorkSlotsMultiSelectItem[] {
  const mapped = opts.map((o) => {
    const code = o.value.trim();
    return {
      value: code,
      label: cityStoredCodeToDisplayLabel(code, o.label)
    };
  });
  return refOptionsToPickerItems(mapped);
}

export function entitiesToItems(entities: { id: number; name: string }[]): WorkSlotsMultiSelectItem[] {
  return entities.map((e) => ({ id: String(e.id), title: e.name }));
}

function pickOne(next: string[]) {
  return next.slice(-1);
}

type Props = {
  variant?: WorkSlotsMultiSelectVariant;
  placeholder: string;
  items: WorkSlotsMultiSelectItem[];
  selectedValues: string[];
  onChange: (next: string[]) => void;
  /** false — oxirgi tanlangan bitta qiymat (tahrir / guruh «задать») */
  multiple?: boolean;
  disabled?: boolean;
  triggerClassName?: string;
};

export function WorkSlotsMultiSelect({
  variant = "filter",
  placeholder,
  items,
  selectedValues,
  onChange,
  multiple = true,
  disabled,
  triggerClassName
}: Props) {
  const preset = VARIANT_PRESETS[variant];
  return (
    <SupervisorDashboardMultiFilter
      placeholder={placeholder}
      searchPlaceholder={placeholder}
      triggerClassName={triggerClassName ?? preset.triggerClass}
      minPopoverWidth={preset.minPopoverWidth}
      maxListHeightClass={preset.maxListHeightClass}
      hidePopoverHeader={preset.hidePopoverHeader}
      items={items}
      selectedValues={selectedValues}
      onChange={multiple ? onChange : (next) => onChange(pickOne(next))}
      disabled={disabled}
    />
  );
}

"use client";

import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import type { MultiItem } from "./flat-report-helpers";

export function MultiFilter(props: {
  placeholder: string;
  items: MultiItem[];
  selectedValues: string[];
  onChange: (v: string[]) => void;
  /** Ixcham grid ichida (h-8). */
  compact?: boolean;
  /** Controlled ochilish (accordion — bitta ochiq). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <SearchableMultiSelectPanel
      label={props.placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder="Все"
      items={props.items}
      selected={new Set(props.selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(props.selectedValues)) : next;
        props.onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder="Поиск"
      filterItemsBySearch
      resetAllLabel="Сбросить"
      minPopoverWidth={220}
      maxListHeightClass="max-h-44"
      open={props.open}
      onOpenChange={props.onOpenChange}
      className={cn(props.compact && "min-w-0")}
      triggerClassName={cn(
        props.compact && "h-8 min-h-8 px-2 text-xs ring-offset-0 focus-visible:ring-offset-0"
      )}
    />
  );
}

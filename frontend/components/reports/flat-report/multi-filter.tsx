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
}) {
  return (
    <SearchableMultiSelectPanel
      label={props.placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder={props.placeholder}
      items={props.items}
      selected={new Set(props.selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(props.selectedValues)) : next;
        props.onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={props.placeholder}
      minPopoverWidth={260}
      maxListHeightClass="max-h-44"
      className={cn(props.compact && "min-w-0")}
      triggerClassName={cn(props.compact && "h-8 min-h-8 px-2 text-xs")}
    />
  );
}

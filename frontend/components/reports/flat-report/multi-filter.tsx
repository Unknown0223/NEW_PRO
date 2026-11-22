"use client";

import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import type { MultiItem } from "./flat-report-helpers";

export function MultiFilter(props: {
  placeholder: string;
  items: MultiItem[];
  selectedValues: string[];
  onChange: (v: string[]) => void;
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
    />
  );
}

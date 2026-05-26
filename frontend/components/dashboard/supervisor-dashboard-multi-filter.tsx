"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { SearchableMultiSelectPanel, type SearchableMultiSelectItem } from "@/components/ui/searchable-multi-select-panel";

export type SupervisorDashboardMultiFilterItem = {
  id: string;
  title: string;
  searchText?: string | null;
};

/**
 * Supervisor dashboard: «Продажи по товарам» bilan bir xil qidiruv + checkbox + «Выбрать все на экране».
 */
export const SupervisorDashboardMultiFilter = memo(function SupervisorDashboardMultiFilter(props: {
  placeholder: string;
  searchPlaceholder: string;
  items: SupervisorDashboardMultiFilterItem[];
  selectedValues: string[];
  onChange: (next: string[]) => void;
  triggerClassName?: string;
  disabled?: boolean;
  minPopoverWidth?: number;
  maxListHeightClass?: string;
  hidePopoverHeader?: boolean;
  loading?: boolean;
  closeToken?: number;
  onOpenChange?: (open: boolean) => void;
}) {
  const {
    placeholder,
    searchPlaceholder,
    items,
    selectedValues,
    onChange,
    triggerClassName,
    disabled,
    minPopoverWidth = 220,
    maxListHeightClass = "max-h-56",
    hidePopoverHeader = true,
    loading,
    closeToken,
    onOpenChange
  } = props;
  const [search, setSearch] = useState("");
  const selected = useMemo(() => new Set(selectedValues), [selectedValues]);
  const onSelectedChange = useCallback(
    (next: React.SetStateAction<Set<string>>) => {
      const resolved =
        typeof next === "function" ? (next as (p: Set<string>) => Set<string>)(new Set(selectedValues)) : next;
      onChange(Array.from(resolved));
    },
    [selectedValues, onChange]
  );

  const formatTriggerSummary = useMemo(
    () => (sel: Set<string>, it: SearchableMultiSelectItem<string>[]) => {
      if (sel.size === 0) return placeholder;
      if (sel.size === 1) {
        const id = [...sel][0]!;
        return it.find((x) => x.id === id)?.title ?? id;
      }
      return `Выбрано: ${sel.size}`;
    },
    [placeholder]
  );

  return (
    <SearchableMultiSelectPanel
      label={placeholder}
      hideOuterLabel
      triggerPlaceholder={placeholder}
      triggerClassName={triggerClassName}
      items={items}
      selected={selected}
      onSelectedChange={onSelectedChange}
      searchable
      searchPlaceholder={searchPlaceholder}
      search={search}
      onSearchChange={setSearch}
      filterItemsBySearch
      minPopoverWidth={minPopoverWidth}
      maxListHeightClass={maxListHeightClass}
      hidePopoverHeader={hidePopoverHeader}
      formatTriggerSummary={formatTriggerSummary}
      disabled={disabled}
      loading={loading}
      closeToken={closeToken}
      onOpenChange={onOpenChange}
    />
  );
});

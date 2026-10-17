"use client";

import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { csvFilterSelection, joinCsvFilter } from "./orders-list-filter-ui";

type Item = { id: string; title: string; searchText?: string | null };

type Props = {
  placeholder: string;
  searchPlaceholder?: string;
  items: Item[];
  value: string;
  onChange: (value: string) => void;
  triggerClassName?: string;
  disabled?: boolean;
  minPopoverWidth?: number;
};

/** Qidiruv + checkbox; bir nechta qiymat vergul bilan. */
export function OrdersListSingleMultiFilter({
  placeholder,
  searchPlaceholder,
  items,
  value,
  onChange,
  triggerClassName,
  disabled,
  minPopoverWidth = 220
}: Props) {
  return (
    <SupervisorDashboardMultiFilter
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder ?? placeholder}
      triggerClassName={triggerClassName}
      items={items}
      selectedValues={csvFilterSelection(value)}
      onChange={(next) => onChange(joinCsvFilter(next))}
      disabled={disabled}
      minPopoverWidth={minPopoverWidth}
      hidePopoverHeader
    />
  );
}

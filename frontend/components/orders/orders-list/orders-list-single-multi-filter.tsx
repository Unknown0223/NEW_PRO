"use client";

import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { pickSingleFilterValue, singleFilterSelection } from "./orders-list-filter-ui";

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

/** Supervisor ko‘rinishi: qidiruv + checkbox; URL — bitta qiymat. */
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
      selectedValues={singleFilterSelection(value)}
      onChange={(next) => onChange(pickSingleFilterValue(next, value))}
      disabled={disabled}
      minPopoverWidth={minPopoverWidth}
      hidePopoverHeader
    />
  );
}

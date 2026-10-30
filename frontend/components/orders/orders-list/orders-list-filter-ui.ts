import { filterSelectClassName } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";

/** Supervisor dashboard filtrlari bilan bir xil trigger */
export const ORDERS_FILTER_TRIGGER =
  "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm";

export const ordersFilterRowSelect = cn(filterSelectClassName, ORDERS_FILTER_TRIGGER);

export const ORDERS_FILTER_GRID_CLASS =
  "grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";

/** URL dagi vergul bilan bir nechta qiymat. */
export function csvFilterSelection(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinCsvFilter(next: string[]): string {
  return [...new Set(next.map((s) => s.trim()).filter(Boolean))].join(",");
}

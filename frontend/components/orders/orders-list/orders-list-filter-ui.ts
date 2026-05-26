import { filterSelectClassName } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";

/** Supervisor dashboard filtrlari bilan bir xil trigger */
export const ORDERS_FILTER_TRIGGER =
  "h-8 min-h-8 w-full min-w-0 max-w-none px-2 text-xs font-normal shadow-sm";

export const ordersFilterRowSelect = cn(filterSelectClassName, ORDERS_FILTER_TRIGGER);

export const ORDERS_FILTER_GRID_CLASS =
  "grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";

/** Ko‘p tanlovdan bitta URL qiymat (checkbox UI, bitta aktiv) */
export function pickSingleFilterValue(next: string[], prev: string): string {
  if (next.length === 0) return "";
  if (next.length === 1) return next[0]!;
  const novel = next.find((x) => x !== prev);
  return novel ?? next[next.length - 1]!;
}

export function singleFilterSelection(value: string): string[] {
  return value ? [value] : [];
}

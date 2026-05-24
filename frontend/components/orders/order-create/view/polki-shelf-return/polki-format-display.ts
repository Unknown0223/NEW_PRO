import { formatNumberGrouped } from "@/lib/format-numbers";

/** Summa (so‘m): minglik guruh, butun son. */
export function formatPolkiMoneySum(value: string | number | null | undefined): string {
  return formatNumberGrouped(value, { maxFractionDigits: 0, minFractionDigits: 0 });
}

/** Miqdor (шт): butun son, minglik guruh. */
export function formatPolkiQtyDisplay(value: string | number | null | undefined): string {
  return formatNumberGrouped(value, { maxFractionDigits: 0, minFractionDigits: 0 });
}

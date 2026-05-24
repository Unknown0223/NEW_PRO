import { formatNumberGrouped } from "@/lib/format-numbers";

export function fmtFinanceMoney(v: string | number | null | undefined): string {
  return formatNumberGrouped(v, { minFractionDigits: 2, maxFractionDigits: 2 });
}

export function fmtFinanceCount(v: string | number | null | undefined): string {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

export function fmtFinancePercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value > 0 && value < 0.1) return "<0.1%";
  return `${value.toFixed(1)}%`;
}

export function fmtFinanceCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

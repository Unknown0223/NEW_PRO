import { formatNumberGrouped } from "@/lib/format-numbers";

export function parseSalesProAmount(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function formatSalesMoney(value: number): string {
  return formatNumberGrouped(Math.round(value), { maxFractionDigits: 0, minFractionDigits: 0 });
}

export function compactSalesMoney(value: number): string {
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000)} млн`;
  }
  if (value >= 1_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value / 1000)} тыс.`;
  }
  return String(Math.round(value));
}

export function formatSalesPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
] as const;

export function salesMonthLabel(month: number, year?: number): string {
  const name = MONTHS[Math.max(0, Math.min(11, month - 1))] ?? "";
  return year != null ? `${name} ${year}` : name;
}

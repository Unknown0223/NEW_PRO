import { formatNumberGrouped } from "@/lib/format-numbers";

export function parseFinanceProAmount(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value: number): string {
  return formatNumberGrouped(Math.round(value), { maxFractionDigits: 0, minFractionDigits: 0 });
}

export function compactCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000)} млн`;
  }
  if (value >= 1_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value / 1000)} тыс.`;
  }
  return String(Math.round(value));
}

export function formatIsoToDot(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

export function formatChangePct(value: number | null, negative = false): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"] as const;

export function paymentDateParts(date: string): { day: string; month: string } {
  const [, month, day] = date.split("-");
  const idx = Number(month) - 1;
  return { day: day ?? "", month: MONTHS_SHORT[idx] ?? "" };
}

export function localDateYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
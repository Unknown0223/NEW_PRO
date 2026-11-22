import { quickRangeToDates } from "@/components/dashboard/shared/date-ranges";
import type { FinanceProPeriodKey } from "@/components/dashboard/finance/pro/finance-pro-types";

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function quarterRange(now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const q = Math.floor(today.getMonth() / 3);
  const from = new Date(today.getFullYear(), q * 3, 1);
  const to = new Date(today.getFullYear(), q * 3 + 3, 0);
  return { from: toYmd(from), to: toYmd(to) };
}

export function yearRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function periodKeyToDates(key: FinanceProPeriodKey): { from: string; to: string } {
  if (key === "Сегодня") {
    const range = quickRangeToDates("today");
    return range ?? quarterRange();
  }
  if (key === "Вчера") {
    const range = quickRangeToDates("yesterday");
    return range ?? quarterRange();
  }
  if (key === "Неделя") {
    const range = quickRangeToDates("last7");
    return range ?? quarterRange();
  }
  if (key === "Месяц") {
    const range = quickRangeToDates("this_month");
    return range ?? quarterRange();
  }
  if (key === "Квартал") return quarterRange();
  return yearRange();
}

export function detectFinanceProPeriod(from: string, to: string): FinanceProPeriodKey | "custom" {
  const keys: FinanceProPeriodKey[] = ["Сегодня", "Вчера", "Неделя", "Месяц", "Квартал", "Год"];
  for (const key of keys) {
    const range = periodKeyToDates(key);
    if (range.from === from && range.to === to) return key;
  }
  return "custom";
}
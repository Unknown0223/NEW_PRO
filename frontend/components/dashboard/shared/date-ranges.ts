import type { QuickRangeKey } from "@/components/dashboard/shared/quick-range";

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function quickRangeToDates(key: QuickRangeKey): { from: string; to: string } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "today") {
    const x = toYmd(today);
    return { from: x, to: x };
  }
  if (key === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const x = toYmd(y);
    return { from: x, to: x };
  }
  if (key === "last3") {
    const from = new Date(today);
    from.setDate(from.getDate() - 2);
    return { from: toYmd(from), to: toYmd(today) };
  }
  if (key === "last7") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toYmd(from), to: toYmd(today) };
  }
  if (key === "last30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: toYmd(from), to: toYmd(today) };
  }
  if (key === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toYmd(from), to: toYmd(to) };
  }
  if (key === "prev_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toYmd(from), to: toYmd(to) };
  }
  return null;
}

export function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function formatDateDot(value: string): string {
  const date = parseIsoDate(value);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

export function shiftDateRange(startDate: string, endDate: string, direction: -1 | 1): { from: string; to: string } {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  start.setDate(start.getDate() + rangeDays * direction);
  end.setDate(end.getDate() + rangeDays * direction);
  return { from: toYmd(start), to: toYmd(end) };
}

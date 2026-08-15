import { cn } from "@/lib/utils";
import { formatNumber } from "@/components/plans/setup/planning-utils";

export function fmtMoney(v: number): string {
  return formatNumber(Math.round(v));
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v * 10) / 10}%`;
}

export function formatDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][dt.getUTCDay()] ?? "";
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y} · ${weekday}`;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "done":
      return "Выполнено";
    case "over":
      return "Перевыполнение";
    case "warn":
      return "Частично";
    case "pending":
      return "Ожидается";
    case "off":
      return "Выходной";
    case "no_plan":
      return "Нет плана";
    default:
      return status;
  }
}

export function statusClass(status: string): string {
  switch (status) {
    case "done":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "over":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "warn":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "pending":
      return "bg-slate-50 text-slate-600 border-slate-200";
    case "off":
      return "bg-slate-100 text-slate-400 border-slate-200";
    case "no_plan":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export function StatusBadge({
  status,
  className
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        statusClass(status),
        className
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

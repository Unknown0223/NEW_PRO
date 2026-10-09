"use client";

import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clampRangeToMonth,
  formatPeriodLabel,
  monthFirstYmd,
  monthLastYmd,
  presetRange,
  type DailyKpiPeriod,
  type DailyKpiPeriodPreset
} from "./daily-kpi-period";

const PRESETS: Array<{ id: DailyKpiPeriodPreset; label: string }> = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "custom", label: "Период" }
];

export function DailyKpiPeriodBar({
  period,
  anchorDay,
  onChange
}: {
  period: DailyKpiPeriod;
  /** Yuqoridagi tanlangan kun — oy chegarasi shu kun oyidan olinadi. */
  anchorDay: string;
  onChange: (next: DailyKpiPeriod) => void;
}) {
  const first = monthFirstYmd(anchorDay);
  const last = monthLastYmd(anchorDay);

  const pickPreset = (preset: DailyKpiPeriodPreset) => {
    if (preset === "custom") {
      onChange({ preset, ...clampRangeToMonth(period.from, period.to, anchorDay) });
      return;
    }
    onChange({ preset, ...presetRange(preset, anchorDay) });
  };

  const setCustom = (from: string, to: string) =>
    onChange({ preset: "custom", ...clampRangeToMonth(from, to, anchorDay) });

  const inputCls =
    "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-teal-500";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period.preset === p.id}
            onClick={() => pickPreset(p.id)}
            className={cn(
              "h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition",
              period.preset === p.id ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period.preset === "custom" ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="С даты"
            value={period.from}
            min={first}
            max={last}
            onChange={(e) => setCustom(e.target.value, period.to < e.target.value ? e.target.value : period.to)}
            className={inputCls}
          />
          <span className="text-xs text-slate-400">—</span>
          <input
            type="date"
            aria-label="По дату"
            value={period.to}
            min={period.from}
            max={last}
            onChange={(e) => setCustom(period.from, e.target.value)}
            className={inputCls}
          />
        </div>
      ) : null}

      <span
        className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-800"
        title="Период всегда в пределах одного месяца"
      >
        <CalendarRange className="size-3.5" />
        {formatPeriodLabel(period.from, period.to)}
      </span>
    </div>
  );
}

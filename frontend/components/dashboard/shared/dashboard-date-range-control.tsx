"use client";

import { formatDateDot, quickRangeToDates, shiftDateRange } from "@/components/dashboard/shared/date-ranges";
import type { QuickRangeKey } from "@/components/dashboard/shared/quick-range";
import { DateRangePopover } from "@/components/ui/date-range-popover";
import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";

export function DashboardDateRangeControl({
  from,
  to,
  onChange,
  onQuickRangeChange
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  onQuickRangeChange?: (key: QuickRangeKey) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const shift = (direction: -1 | 1) => {
    const next = shiftDateRange(from, to, direction);
    onChange(next);
    onQuickRangeChange?.("custom");
  };

  return (
    <>
      <div className="relative flex h-12 min-w-0 shrink-0 overflow-visible rounded-xl border border-slate-200 bg-white xl:min-w-[300px]">
        <button
          type="button"
          className="w-11 shrink-0 border-r border-slate-200 text-xl font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-teal-700"
          onClick={() => shift(-1)}
          aria-label="Предыдущий период"
        >
          ‹
        </button>
        <button
          ref={anchorRef}
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-3 text-sm font-semibold text-slate-700"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="min-w-0 truncate">
            {formatDateDot(from)} — {formatDateDot(to)}
          </span>
        </button>
        <button
          type="button"
          className="w-11 shrink-0 border-l border-slate-200 text-xl font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-teal-700"
          onClick={() => shift(1)}
          aria-label="Следующий период"
        >
          ›
        </button>
      </div>
      <DateRangePopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        dateFrom={from}
        dateTo={to}
        onApply={({ dateFrom, dateTo }) => {
          onChange({ from: dateFrom, to: dateTo });
          const presets: QuickRangeKey[] = [
            "today",
            "yesterday",
            "last7",
            "last30",
            "this_month",
            "prev_month"
          ];
          const matched = presets.find((key) => {
            const r = quickRangeToDates(key);
            return r?.from === dateFrom && r?.to === dateTo;
          });
          onQuickRangeChange?.(matched ?? "custom");
        }}
      />
    </>
  );
}

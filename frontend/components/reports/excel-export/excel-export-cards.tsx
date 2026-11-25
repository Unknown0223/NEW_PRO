"use client";

import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";

export type StatusCard = {
  id: string;
  label: string;
  statuses: string[];
  amount: string;
  qty: string;
  volume: string;
  akb: number;
};

const TONE: Record<string, string> = {
  all: "border-sky-500/70 bg-sky-50/80",
  new: "border-pink-500/70 bg-pink-50/80",
  shipped: "border-orange-500/70 bg-orange-50/80",
  delivered: "border-emerald-500/70 bg-emerald-50/80",
  returned: "border-red-500/70 bg-red-50/80",
  cancelled: "border-slate-400/70 bg-slate-50/80"
};

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

/** SalesDoc Version1 status panels. */
export function ExcelExportStatusCards({
  cards,
  activeId,
  onSelect
}: {
  cards: StatusCard[];
  activeId: string;
  onSelect: (card: StatusCard) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const active = activeId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            className={cn(
              "rounded-md border-l-4 border border-border px-2.5 py-2 text-left transition-shadow",
              TONE[c.id] ?? "border-l-primary bg-card",
              active && "ring-2 ring-primary/40 shadow-sm"
            )}
          >
            <div className="text-[11px] font-semibold text-foreground/90">{c.label}</div>
            <div className="mt-0.5 text-base font-bold tabular-nums tracking-tight">
              {money(c.amount)}
            </div>
            <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
              <div>
                Количество: <span className="font-semibold text-foreground">{money(c.qty)}</span>
              </div>
              <div>
                Объём: <span className="font-semibold text-foreground">{money(c.volume)}</span>
              </div>
              <div>
                АКБ: <span className="font-semibold text-foreground">{c.akb}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

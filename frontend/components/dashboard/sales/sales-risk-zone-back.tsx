"use client";

import { fmtCount } from "@/components/dashboard/sales/format";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

type RiskZone = NonNullable<SalesDashboardSnapshot["risk_zone"]>;

type Row = { label: string; clients: number; barClass: string };

export function riskZonePct(risk: RiskZone | undefined, fallbackCoveragePct: number): number {
  if (!risk) return Math.max(0, 100 - fallbackCoveragePct);
  if (risk.okb <= 0) return 0;
  return Math.min(100, Math.max(0, ((risk.okb - risk.with_order) / risk.okb) * 100));
}

export function RiskZoneFrontValue({ okb, akb }: { okb: number; akb: number }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-3">
      {[
        { label: "ОКБ", value: okb },
        { label: "АКБ", value: akb }
      ].map((x) => (
        <div key={x.label} className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{x.label}</p>
          <p
            className="truncate text-2xl font-bold leading-tight tabular-nums text-slate-950"
            title={fmtCount(x.value)}
          >
            {fmtCount(x.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function RiskZoneBack({ risk }: { risk: RiskZone | undefined }) {
  const rows: Row[] = risk
    ? [
        { label: "Заказ", clients: risk.with_order, barClass: "bg-emerald-500" },
        { label: "Отказ", clients: risk.with_refusal, barClass: "bg-amber-500" },
        ...(risk.visited_only > 0
          ? [{ label: "Визит без заказа", clients: risk.visited_only, barClass: "bg-slate-400" }]
          : []),
        { label: "Непосещение", clients: risk.not_visited, barClass: "bg-red-500" }
      ]
    : [];
  const okb = risk?.okb ?? 0;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">Клиенты (ОКБ: {fmtCount(okb)})</p>
        <RotateCcw className="h-4 w-4 text-slate-400" aria-hidden />
      </div>
      {okb === 0 ? (
        <p className="text-sm text-slate-400">Нет закреплённых клиентов</p>
      ) : (
        <ul className="-mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
          {rows.map((r) => {
            const pct = Math.min(100, (r.clients / okb) * 100);
            return (
              <li key={r.label} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-slate-600">{r.label}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-950">
                    {fmtCount(r.clients)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn("h-full rounded-full", r.barClass)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

"use client";

import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { coverageClass, fmtCount, fmtMoney, pct } from "@/components/dashboard/monitoring/utils";
import { cn } from "@/lib/utils";

/** Shablon: to‘liq kenglikdagi «Акб по портфелям и по филиалам». */
export function MonitoringPortfolioSection({ branches }: { branches: MonitoringSnapshot["branch_performance"] }) {
  const hasRows = branches.length > 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Акб по портфелям и по филиалам</h2>
      {!hasRows ? (
        <p className="py-8 text-center text-sm text-slate-500">Нет данных по филиалам за период</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Филиал</th>
                <th className="px-4 py-3 text-right font-medium">АКБ</th>
                <th className="px-4 py-3 text-right font-medium">ОКБ</th>
                <th className="px-4 py-3 text-right font-medium">Покрытие</th>
                <th className="px-4 py-3 text-right font-medium">Факт</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((r) => (
                <tr key={r.branch} className="border-b border-border hover:bg-teal-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.branch}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCount(r.akb)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCount(r.okb ?? 0)}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right tabular-nums font-medium",
                      r.coverage_pct != null ? coverageClass(r.coverage_pct) : ""
                    )}
                  >
                    {r.coverage_pct != null ? pct(r.coverage_pct) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.fact_sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

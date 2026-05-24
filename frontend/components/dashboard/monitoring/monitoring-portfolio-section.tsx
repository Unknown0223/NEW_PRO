"use client";

import { SalesSectionPanel } from "@/components/dashboard/sales/sales-section-panel";
import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { coverageClass, fmtCount, fmtMoney, pct } from "@/components/dashboard/monitoring/utils";
import { cn } from "@/lib/utils";

/** Упрощённая матрица портфеля: АКБ/ОКБ/покрытие по филиалам (полная SKU×филиал — отдельный источник). */
export function MonitoringPortfolioSection({ branches }: { branches: MonitoringSnapshot["branch_performance"] }) {
  const top = branches.slice(0, 12);
  return (
    <SalesSectionPanel
      className="sales-motion-delay-200 h-full min-h-[320px]"
      title="АКБ по портфелям и по филиалам"
      subtitle="АКБ / ОКБ по филиалу"
    >
      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Филиал</th>
              <th className="px-3 py-2.5 text-right font-medium">АКБ</th>
              <th className="px-3 py-2.5 text-right font-medium">ОКБ</th>
              <th className="px-3 py-2.5 text-right font-medium">Покрытие</th>
              <th className="px-3 py-2.5 text-right font-medium">Факт</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {top.map((r) => (
              <tr key={r.branch} className="hover:bg-slate-50/70">
                <td className="px-3 py-2.5 font-medium">{r.branch}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtCount(r.akb)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtCount(r.okb ?? 0)}</td>
                <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", r.coverage_pct != null ? coverageClass(r.coverage_pct) : "")}>
                  {r.coverage_pct != null ? pct(r.coverage_pct) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(r.fact_sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SalesSectionPanel>
  );
}

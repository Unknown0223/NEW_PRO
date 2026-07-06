"use client";

import { fmtCount, fmtMoney, formatReasonLabel } from "@/components/dashboard/sales/format";
import { salesExportButtonClass, SalesSectionHeader } from "@/components/dashboard/sales/sales-section-header";
import { SalesTablePager } from "@/components/dashboard/sales/sales-table-pager";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { useState } from "react";

export function SalesRefusalsTerritorySection({
  data,
  resolveTerritory,
  onExportRefusals,
  onExportTerritory
}: {
  data: SalesDashboardSnapshot;
  resolveTerritory: (ref: string) => string;
  onExportRefusals: () => void;
  onExportTerritory: () => void;
}) {
  const [territoryPage, setTerritoryPage] = useState(1);
  const [territoryPageSize, setTerritoryPageSize] = useState(10);
  const territoryRows = data.territory_analytics.slice(
    (territoryPage - 1) * territoryPageSize,
    territoryPage * territoryPageSize
  );

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section className="flex min-h-0 flex-col rounded-2xl bg-card shadow-sm ring-1 ring-slate-200/70">
        <SalesSectionHeader
          title="Причина отказа"
          exportAction={
            <button type="button" className={salesExportButtonClass} onClick={onExportRefusals}>
              Excel
            </button>
          }
        />
        <div className="overflow-x-auto p-4 pt-0">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-slate-500">
                <th className="px-2 py-2 text-left">Причина</th>
                <th className="px-2 py-2 text-right">Кол-во</th>
                <th className="px-2 py-2 text-right">Доля</th>
              </tr>
            </thead>
            <tbody>
              {data.refusal_reason_analytics.map((r) => (
                <tr key={r.reason} className="border-b border-slate-50">
                  <td className="px-2 py-1.5">{formatReasonLabel(r.reason)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.count)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.share_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex min-h-0 flex-col rounded-2xl bg-card shadow-sm ring-1 ring-slate-200/70">
        <SalesSectionHeader
          title="Аналитика по территориям"
          exportAction={
            <button type="button" className={salesExportButtonClass} onClick={onExportTerritory}>
              Excel
            </button>
          }
        />
        <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span>Строк на странице</span>
            <select
              className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
              value={String(territoryPageSize)}
              onChange={(e) => {
                setTerritoryPageSize(Number.parseInt(e.target.value, 10) || 10);
                setTerritoryPage(1);
              }}
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto px-4">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-slate-500">
                <th className="px-2 py-2 text-left">Территория</th>
                <th className="px-2 py-2 text-right">Сумма</th>
                <th className="px-2 py-2 text-right">АКБ</th>
                <th className="px-2 py-2 text-right">ОКБ</th>
                <th className="px-2 py-2 text-right">Процент ОКБ</th>
              </tr>
            </thead>
            <tbody>
              {territoryRows.map((r) => (
                <tr key={r.territory} className="border-b border-slate-50">
                  <td className="px-2 py-1.5">{resolveTerritory(r.territory)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sales_sum)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.akb)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.okb)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.coverage_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SalesTablePager
          total={data.territory_analytics.length}
          page={territoryPage}
          pageSize={territoryPageSize}
          onPageChange={setTerritoryPage}
        />
      </section>
    </div>
  );
}

"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";

export function SalesKpiSection({ data }: { data: SalesDashboardSnapshot }) {
  const cards = [
    { label: "Общая сумма", value: fmtMoney(data.total_sales_summary.total_sales_sum) },
    { label: "Заказы", value: fmtCount(data.total_sales_summary.orders_count) },
    { label: "АКБ", value: fmtCount(data.akb_okb_block.akb) },
    { label: "ОКБ", value: fmtCount(data.akb_okb_block.okb) },
    { label: "Процент ОКБ", value: `${data.akb_okb_block.coverage_pct.toFixed(1)}%` }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-slate-200/70"
        >
          <p className="text-xs font-medium text-slate-500">{c.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

"use client";

import { fmtFinanceMoney, fmtFinancePercent } from "@/components/dashboard/finance/format";
import type { FinanceSummaryBlock } from "@/components/dashboard/finance/types";

const ITEMS: Array<{
  key: keyof FinanceSummaryBlock | "debt_ratio_pct";
  label: string;
  format: "money" | "pct";
}> = [
  { key: "total_sales_sum", label: "Продажи", format: "money" },
  { key: "total_payments_sum", label: "Оплаты", format: "money" },
  { key: "net_sales_sum", label: "Чистые продажи", format: "money" },
  { key: "outstanding_debt_sum", label: "Задолженность", format: "money" },
  { key: "debt_ratio_pct", label: "Доля долга", format: "pct" }
];

export function FinanceSummaryStrip({ summary }: { summary: FinanceSummaryBlock }) {
  return (
    <section className="finance-motion-fade grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {ITEMS.map((item) => {
        const raw = summary[item.key as keyof FinanceSummaryBlock];
        const value =
          item.format === "pct"
            ? fmtFinancePercent(Number(raw))
            : fmtFinanceMoney(String(raw));
        return (
          <div
            key={item.key}
            className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-1 truncate text-lg font-black tabular-nums text-slate-950">{value}</p>
          </div>
        );
      })}
    </section>
  );
}

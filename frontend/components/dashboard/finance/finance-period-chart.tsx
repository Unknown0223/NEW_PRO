"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceCompact } from "@/components/dashboard/finance/format";
import type { FinanceDashboardSnapshot } from "@/components/dashboard/finance/types";
import { useMemo } from "react";

export function FinancePeriodChart({ data }: { data: FinanceDashboardSnapshot }) {
  const points = data.debt_and_payment_by_period;
  const maxVal = useMemo(() => {
    let m = 1;
    for (const p of points) {
      m = Math.max(m, Number(p.debt_sum), Number(p.payment_sum));
    }
    return m;
  }, [points]);

  const width = 900;
  const height = 220;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = useMemo(() => {
    if (points.length === 0) return { debt: "", pay: "" };
    const step = points.length <= 1 ? innerW : innerW / (points.length - 1);
    const toY = (v: number) => padY + innerH - (v / maxVal) * innerH;
    const debtPts = points.map((p, i) => `${padX + i * step},${toY(Number(p.debt_sum))}`);
    const payPts = points.map((p, i) => `${padX + i * step},${toY(Number(p.payment_sum))}`);
    return { debt: debtPts.join(" "), pay: payPts.join(" ") };
  }, [points, maxVal, innerH, innerW, padX, padY]);

  return (
    <section className="finance-motion-fade rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader title="Долг и оплаты по периоду" subtitle="Динамика по дням" />
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[640px] w-full" role="img" aria-label="График долга и оплат">
          <polyline
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.5"
            className="finance-chart-line"
            points={coords.debt}
          />
          <polyline
            fill="none"
            stroke="#14b8a6"
            strokeWidth="2.5"
            className="finance-chart-line"
            points={coords.pay}
          />
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded bg-rose-500" />
          Долг (max {fmtFinanceCompact(maxVal)})
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded bg-teal-500" />
          Оплаты
        </span>
      </div>
    </section>
  );
}

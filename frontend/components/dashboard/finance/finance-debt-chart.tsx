"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinancePercent } from "@/components/dashboard/finance/format";

export function FinanceDebtChart({ debtRatioPct }: { debtRatioPct: number }) {
  const debt = Math.min(100, Math.max(0, debtRatioPct));
  const paid = Math.max(0, 100 - debt);

  return (
    <section className="finance-motion-slide h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader title="Долг / оплата" subtitle="Доля задолженности к чистым продажам" />
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-6">
        <div
          className="flex h-56 w-56 items-center justify-center rounded-full p-6 shadow-inner"
          style={{
            background: `conic-gradient(#14b8a6 0 ${paid}%, #f43f5e ${paid}% 100%)`
          }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white ring-1 ring-slate-100">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Долг</span>
            <strong className="mt-1 text-3xl font-black text-rose-600">{fmtFinancePercent(debt)}</strong>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-slate-600">
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 rounded-full bg-teal-500" />
            Оплачено ~{fmtFinancePercent(paid)}
          </span>
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 rounded-full bg-rose-500" />
            Долг {fmtFinancePercent(debt)}
          </span>
        </div>
      </div>
    </section>
  );
}

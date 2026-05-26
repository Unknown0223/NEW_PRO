"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinancePercent } from "@/components/dashboard/finance/format";

function RatioLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
        <span className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${color}`} />
          {label}
        </span>
        <span>{fmtFinancePercent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`finance-motion-bar h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function FinanceDebtChart({ debtRatioPct }: { debtRatioPct: number }) {
  const debt = Math.min(100, Math.max(0, debtRatioPct));
  const paid = Math.max(0, 100 - debt);
  const gradient = `conic-gradient(#04b735 0 ${paid}%, #ffffff ${paid}% ${paid + 2}%, #e91d24 ${paid + 2}% 100%)`;

  return (
    <section className="finance-motion-slide h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader
        title="По долгу"
        subtitle="Соотношение оплаченного и задолженности"
      />
      <div className="grid min-h-[320px] grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(220px,280px),minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(220px,280px),minmax(0,1fr)]">
        <div
          className="mx-auto flex h-64 w-64 items-center justify-center rounded-full p-8 shadow-inner"
          style={{ background: gradient }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center ring-1 ring-slate-100">
            <span className="text-sm font-semibold text-slate-500">Оплачено</span>
            <strong className="text-4xl font-black text-emerald-600">{fmtFinancePercent(paid)}</strong>
          </div>
        </div>
        <div className="space-y-3">
          <RatioLine label="Оплачено" value={paid} color="bg-emerald-500" />
          <RatioLine label="Долг" value={debt} color="bg-red-500" />
        </div>
      </div>
    </section>
  );
}

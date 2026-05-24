"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceMoney, fmtFinancePercent } from "@/components/dashboard/finance/format";
import { formatPaymentMethodLabel } from "@/components/dashboard/finance/payment-method-options";
import type { FinanceDashboardSnapshot } from "@/components/dashboard/finance/types";
import { useMemo } from "react";

const TONE_CLASSES = [
  "bg-teal-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-cyan-500",
  "bg-orange-500"
] as const;

export function FinanceKpiSection({ data }: { data: FinanceDashboardSnapshot }) {
  const rows = data.payment_type_analytics;
  const total = useMemo(
    () => rows.reduce((s, r) => s + Math.max(0, Number(r.amount)), 0),
    [rows]
  );
  return (
    <section className="finance-motion-fade rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader
        title="Продажа"
        subtitle={
          data.filters.payment_types.length > 0
            ? "Агрегация по выбранным способам оплаты"
            : "Агрегация по каналам оплаты"
        }
      />
      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {rows.length === 0 ? (
          <div className="col-span-full rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Нет данных по способам оплаты за период
          </div>
        ) : (
          rows.map((row, index) => {
            const amount = Number(row.amount);
            const pct = total > 0 ? Math.min(100, (amount / total) * 100) : row.share_pct;
            const tone = TONE_CLASSES[index % TONE_CLASSES.length]!;
            return (
              <article
                key={`${row.payment_type}-${index}`}
                className="finance-motion-fade flex min-h-[168px] flex-col justify-between rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100"
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className={`h-1.5 w-16 rounded-full ${tone}`} />
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                      {fmtFinancePercent(pct)}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-500">
                    {formatPaymentMethodLabel(row.payment_type)}
                  </p>
                  <p className="mt-1 truncate text-[clamp(1.08rem,1.18vw,1.38rem)] font-black tracking-tight text-slate-950">
                    {fmtFinanceMoney(row.amount)}
                  </p>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`finance-motion-bar h-full rounded-full ${tone}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

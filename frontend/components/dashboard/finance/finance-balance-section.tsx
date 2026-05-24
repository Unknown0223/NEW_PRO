"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceCount, fmtFinanceMoney } from "@/components/dashboard/finance/format";
import type { FinanceDashboardSnapshot } from "@/components/dashboard/finance/types";

export function FinanceBalanceSection({ data }: { data: FinanceDashboardSnapshot }) {
  const b = data.general_balance;
  const total = Number(b.total_balance);
  const items = [
    { label: "Общий баланс", value: total, accent: true },
    { label: "Клиенты в долгу", value: b.debt_clients_count, count: true },
    { label: "Клиенты с авансом", value: b.credit_clients_count, count: true },
    { label: "Задолженность", value: Number(data.summary.outstanding_debt_sum), accent: false },
    { label: "Оплаты", value: Number(data.summary.total_payments_sum), accent: false }
  ];

  return (
    <section className="finance-motion-fade rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader title="Общий баланс" subtitle="с учётом предоплаты и фильтров" />
      <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {items.map((item) => {
          const negative = !item.count && Number(item.value) < 0;
          const display = item.count ? fmtFinanceCount(item.value) : fmtFinanceMoney(item.value);
          return (
            <div
              key={item.label}
              className={`flex min-h-[98px] items-center rounded-xl px-4 py-3 ring-1 ring-slate-100 ${
                item.accent ? "bg-gradient-to-r from-slate-50 to-cyan-50" : "bg-slate-50"
              }`}
            >
              <div className="flex w-full items-center gap-3">
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${
                    item.count ? "bg-teal-500" : negative ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                  <p
                    className={`mt-0.5 truncate text-[clamp(1.05rem,1.2vw,1.35rem)] font-black tracking-tight ${
                      negative ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {display}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

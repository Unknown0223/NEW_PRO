"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceMoney } from "@/components/dashboard/finance/format";
import type { FinanceDashboardSnapshot } from "@/components/dashboard/finance/types";

export function FinanceBalanceSection({ data }: { data: FinanceDashboardSnapshot }) {
  const s = data.summary;
  const items = [
    { label: "Продажи за период", hint: "Сумма заказов", value: Number(s.total_sales_sum), accent: true },
    { label: "Оплаты за период", hint: "Деньги от клиентов", value: Number(s.total_payments_sum), accent: false },
    { label: "Возвраты", hint: "Проведённые возвраты", value: Number(s.total_returns_sum), accent: false },
    { label: "Чистые продажи", hint: "Продажи минус возвраты", value: Number(s.net_sales_sum), accent: false },
    {
      label: "Неоплаченный долг",
      hint: "Остаток доставленных заказов",
      value: Number(s.outstanding_debt_sum),
      accent: false
    }
  ];

  return (
    <section className="finance-motion-fade flex h-full flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader title="Итоги периода" subtitle="Заказы, оплаты, возвраты и долг за выбранные даты" />
      <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {items.map((item) => {
          const negative = Number(item.value) < 0;
          return (
            <div
              key={item.label}
              className={`flex min-h-[98px] items-center rounded-xl px-4 py-3 ring-1 ring-slate-100 ${
                item.accent ? "bg-gradient-to-r from-slate-50 to-cyan-50" : "bg-muted"
              }`}
            >
              <div className="flex w-full items-center gap-3">
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${
                    negative ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.hint}</p>
                  <p
                    className={`mt-0.5 truncate text-[clamp(1.05rem,1.2vw,1.35rem)] font-black tracking-tight ${
                      negative ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {fmtFinanceMoney(item.value)}
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

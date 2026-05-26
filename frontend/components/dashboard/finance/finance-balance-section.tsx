"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceMoney } from "@/components/dashboard/finance/format";
import { bucketPaymentChannels } from "@/components/dashboard/finance/payment-channel-buckets";
import type { FinanceDashboardSnapshot } from "@/components/dashboard/finance/types";

export function FinanceBalanceSection({ data }: { data: FinanceDashboardSnapshot }) {
  const channels = bucketPaymentChannels(data.payment_type_analytics);
  const uzs = Number(data.general_balance.total_balance);
  const items = [
    { label: "UZS", value: uzs, accent: true },
    { label: "Pereches", value: channels.transfer, accent: false },
    { label: "Tenge", value: channels.tenge, accent: false },
    { label: "Terminal", value: channels.terminal, accent: false },
    { label: "Naqd", value: channels.cash, accent: false }
  ];

  return (
    <section className="finance-motion-fade flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader title="Общий баланс" subtitle="с учётом предоплаты" />
      <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {items.map((item) => {
          const negative = Number(item.value) < 0;
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
                    negative ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-500">{item.label}</p>
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

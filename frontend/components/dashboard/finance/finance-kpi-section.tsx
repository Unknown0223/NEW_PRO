"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceMoney, fmtFinancePercent } from "@/components/dashboard/finance/format";
import { formatPaymentMethodLabel } from "@/components/dashboard/finance/payment-method-options";
import type { FinanceDashboardSnapshot } from "@/components/dashboard/finance/types";
import { useMemo } from "react";

const TONE_GRADIENT = [
  "from-teal-500 to-cyan-400",
  "from-sky-500 to-blue-400",
  "from-amber-500 to-orange-400",
  "from-violet-500 to-fuchsia-400",
  "from-emerald-500 to-teal-400",
  "from-cyan-500 to-sky-400",
  "from-orange-500 to-amber-400"
] as const;

const TONE_SOLID = [
  "bg-teal-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-cyan-500",
  "bg-orange-500"
] as const;

const HELPERS: Record<string, string> = {
  cash: "инкассация наличных",
  naqd: "инкассация наличных",
  налич: "инкассация наличных",
  transfer: "банковский перевод",
  перечисл: "банковский перевод",
  terminal: "эквайринг",
  терминал: "эквайринг",
  пластик: "эквайринг",
  tenge: "наличные в валюте",
  тенге: "наличные в валюте"
};

function helperFor(label: string): string {
  const key = label.trim().toLowerCase();
  for (const [k, v] of Object.entries(HELPERS)) {
    if (key.includes(k)) return v;
  }
  return "канал оплаты";
}

type PaymentMethodEntry = { id: string; name: string; code?: string | null };

export function FinanceKpiSection({
  data,
  paymentEntries
}: {
  data: FinanceDashboardSnapshot;
  paymentEntries?: PaymentMethodEntry[];
}) {
  const rows = useMemo(() => {
    const byLabel = new Map<string, { amount: number; raw: string }>();
    for (const row of data.payment_type_analytics) {
      const label = formatPaymentMethodLabel(row.payment_type, undefined, paymentEntries);
      const amount = Math.max(0, Number(row.amount));
      const prev = byLabel.get(label);
      byLabel.set(label, {
        amount: (prev?.amount ?? 0) + (Number.isFinite(amount) ? amount : 0),
        raw: row.payment_type
      });
    }
    return [...byLabel.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([label, v]) => ({ label, amount: v.amount, raw: v.raw }));
  }, [data.payment_type_analytics, paymentEntries]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  return (
    <section className="finance-motion-fade flex h-full flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader
        title="Оплаты по способам"
        subtitle="Сколько денег пришло каждым способом за выбранный период"
      />
      <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {rows.length === 0 ? (
          <div className="col-span-full rounded-xl bg-muted px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-100">
            Нет данных по способам оплаты за период
          </div>
        ) : (
          rows.map((row, index) => {
            const pct = total > 0 ? Math.min(100, (row.amount / total) * 100) : 0;
            const gradient = TONE_GRADIENT[index % TONE_GRADIENT.length]!;
            const solid = TONE_SOLID[index % TONE_SOLID.length]!;
            return (
              <article
                key={`${row.label}-${index}`}
                className="finance-motion-fade flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl bg-muted p-4 ring-1 ring-slate-100"
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${gradient}`} />
                    <span className="rounded-full bg-card px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                      {fmtFinancePercent(pct)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-500">{row.label}</p>
                    <span className="text-xs font-bold text-slate-400">доля</span>
                  </div>
                  <p className="mt-1 truncate text-[clamp(1.08rem,1.18vw,1.38rem)] font-black tracking-tight text-slate-950">
                    {fmtFinanceMoney(row.amount)}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {helperFor(row.label)}
                  </p>
                </div>
                <div className="mt-5">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`finance-motion-bar h-full rounded-full ${solid}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

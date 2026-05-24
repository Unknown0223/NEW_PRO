"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { Activity, CircleDollarSign, CreditCard, Gauge } from "lucide-react";
import { useMemo } from "react";

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
  trend
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "teal" | "green" | "blue" | "red";
  trend?: string;
}) {
  const toneRing = {
    teal: "bg-teal-100 text-teal-700 ring-teal-200",
    green: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    blue: "bg-blue-100 text-blue-700 ring-blue-200",
    red: "bg-red-100 text-red-700 ring-red-200"
  }[tone];

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-900/5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${toneRing}`}>
          <Icon className="h-5 w-5" />
        </span>
        {trend ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            {trend}
          </span>
        ) : null}
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function SalesMetricsRow({ data }: { data: SalesDashboardSnapshot }) {
  const totalPayment = useMemo(
    () =>
      data.payment_method_analytics.reduce((s, r) => s + Math.max(0, Number(r.sales_sum)), 0),
    [data.payment_method_analytics]
  );
  const { akb, okb, coverage_pct } = data.akb_okb_block;
  const refusalRate = Math.max(0, 100 - coverage_pct);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Общая сумма"
        value={`${fmtMoney(data.total_sales_summary.total_sales_sum)} UZS`}
        description="Сумма продаж за выбранный период"
        icon={CircleDollarSign}
        tone="teal"
        trend={`${coverage_pct.toFixed(1)}% ОКБ`}
      />
      <MetricCard
        title="Payment Breakdown"
        value={`${fmtMoney(totalPayment)} UZS`}
        description="Сумма по способам оплаты"
        icon={CreditCard}
        tone="blue"
      />
      <MetricCard
        title="Coverage conversion"
        value={`${coverage_pct.toFixed(1)}%`}
        description={`${fmtCount(akb)} АКБ / ${fmtCount(okb)} ОКБ`}
        icon={Gauge}
        tone="green"
      />
      <MetricCard
        title="Risk zone"
        value={`${refusalRate.toFixed(1)}%`}
        description={`Отклонено: ${fmtCount(data.orders_refusals.rejected)} из ${fmtCount(data.orders_refusals.total)}`}
        icon={Activity}
        tone="red"
      />
    </div>
  );
}

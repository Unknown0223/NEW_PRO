"use client";

import { fmtCount, fmtMoney, formatReasonLabel } from "@/components/dashboard/sales/format";
import {
  SALES_CHART_COLORS,
  SALES_GREEN,
  SALES_RED,
  SALES_TEAL
} from "@/components/dashboard/sales/sales-chart-theme";
import { SalesIconBadge, SalesSectionPanel } from "@/components/dashboard/sales/sales-section-panel";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { CreditCard } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const chartLoading = () => (
  <div className="h-[280px] animate-pulse rounded-lg bg-slate-100" aria-hidden />
);

const RechartsBundle = dynamic(() => import("@/components/dashboard/sales/sales-recharts-bundle"), {
  ssr: false,
  loading: chartLoading
});

function ProductDonut({
  title,
  items,
  delay
}: {
  title: string;
  items: Array<{ name: string; share: number }>;
  delay?: string;
}) {
  return (
    <SalesSectionPanel title={title} className={delay}>
      <RechartsBundle kind="product-donut" items={items} colors={[...SALES_CHART_COLORS]} />
    </SalesSectionPanel>
  );
}

export function SalesProductAnalytics({ data }: { data: SalesDashboardSnapshot }) {
  const productCategories = useMemo(
    () => data.product_category_analytics.map((r) => ({ name: r.category, share: r.share_pct })),
    [data.product_category_analytics]
  );
  const productGroups = useMemo(
    () => data.product_group_analytics.map((r) => ({ name: r.product_group, share: r.share_pct })),
    [data.product_group_analytics]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ProductDonut title="По категории продуктов" items={productCategories} delay="sales-motion-delay-150" />
      <ProductDonut title="По группам продуктов" items={productGroups} delay="sales-motion-delay-200" />
    </div>
  );
}

export function SalesPaymentRail({
  data,
  resolvePayment
}: {
  data: SalesDashboardSnapshot;
  resolvePayment: (ref: string) => string;
}) {
  const items = useMemo(
    () =>
      data.payment_method_analytics.map((r, i) => ({
        name: resolvePayment(r.payment_type),
        value: Number(r.sales_sum) || 0,
        color: SALES_CHART_COLORS[i % SALES_CHART_COLORS.length]!
      })),
    [data.payment_method_analytics, resolvePayment]
  );

  return (
    <SalesSectionPanel
      title="По способам оплаты"
      subtitle="Payment mix savdo oqimini va inkassatsiya risklarini tez ajratadi."
      action={<SalesIconBadge icon={CreditCard} tone="blue" />}
    >
      <RechartsBundle kind="payment-pie" items={items} />
    </SalesSectionPanel>
  );
}

export function SalesOrdersRefusalsChart({ data }: { data: SalesDashboardSnapshot }) {
  const chartData = useMemo(() => {
    const ratio =
      data.orders_refusals.total > 0
        ? data.orders_refusals.rejected / data.orders_refusals.total
        : 0;
    return data.sales_dynamics.map((r) => {
      const label = r.period.length >= 10 ? r.period.slice(8, 10) + "." + r.period.slice(5, 7) : r.period;
      const orders = r.orders_count;
      return {
        date: label,
        orders,
        refusals: Math.max(0, Math.round(orders * ratio))
      };
    });
  }, [data.sales_dynamics, data.orders_refusals]);

  const { akb, okb, coverage_pct } = data.akb_okb_block;

  return (
    <SalesSectionPanel
      title="Заказы / Отказы"
      subtitle="OKБ dan AKБ ga o'tishdagi uzilishlar kunlar kesimida ko'rinadi."
      className="sales-motion-delay-150"
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">ОКБ</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{fmtCount(okb)}</p>
          <p className="mt-1 text-xs text-slate-400">planned customers</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-slate-500">АКБ</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{fmtCount(akb)}</p>
          <p className="mt-1 text-xs text-slate-400">actual ordered customers</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">Conversion</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{coverage_pct.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-400">АКБ / ОКБ × 100</p>
        </div>
      </div>
      <RechartsBundle kind="orders-refusals" data={chartData} green={SALES_GREEN} red={SALES_RED} />
    </SalesSectionPanel>
  );
}

export function SalesRefusalReasonsBlock({ data }: { data: SalesDashboardSnapshot }) {
  const refusals = useMemo(
    () =>
      data.refusal_reason_analytics.map((r) => ({
        reason: formatReasonLabel(r.reason),
        count: r.count
      })),
    [data.refusal_reason_analytics]
  );

  return (
    <div className="grid gap-4">
      <SalesSectionPanel title="Причина отказа" className="sales-motion-delay-200">
        <RechartsBundle kind="refusal-bar" data={refusals} teal={SALES_TEAL} />
      </SalesSectionPanel>
      <SalesSectionPanel title="Динамика причин отказов" className="sales-motion-delay-250">
        <p className="mb-3 text-sm text-slate-500">
          Показатели по дням будут доступны в следующем обновлении API. Сейчас — сводка по причинам
          за период.
        </p>
        <RechartsBundle kind="refusal-bar" data={refusals} teal={SALES_TEAL} />
      </SalesSectionPanel>
    </div>
  );
}

export function SalesTrendAreaChart({ data }: { data: SalesDashboardSnapshot }) {
  const trend = useMemo(
    () =>
      data.sales_dynamics.map((r) => ({
        date: r.period.length >= 10 ? r.period.slice(5, 10) : r.period,
        amount: Number(r.sales_sum) || 0
      })),
    [data.sales_dynamics]
  );

  return (
    <SalesSectionPanel title="Динамика продаж" className="sales-motion-delay-250">
      <RechartsBundle kind="sales-area" data={trend} green={SALES_GREEN} />
    </SalesSectionPanel>
  );
}

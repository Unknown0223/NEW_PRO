"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceMoney } from "@/components/dashboard/finance/format";
import {
  fillFinancePeriodSeries,
  formatFinancePeriodLabel
} from "@/components/dashboard/finance/finance-period-utils";
import { bucketPaymentChannels } from "@/components/dashboard/finance/payment-channel-buckets";
import type {
  FinanceDashboardSnapshot,
  FinancePeriodBalanceBlock,
  FinancePeriodRow
} from "@/components/dashboard/finance/types";
import { useMemo } from "react";

function resolvePeriodBalance(data: FinanceDashboardSnapshot): FinancePeriodBalanceBlock {
  if (data.period_balance) return data.period_balance;
  const ch = bucketPaymentChannels(data.payment_type_analytics);
  const payments = Number(data.summary.total_payments_sum);
  const debt = Number(data.summary.outstanding_debt_sum);
  return {
    uzs: String(payments - debt),
    cash: String(ch.cash),
    transfer: String(ch.transfer),
    terminal: String(ch.terminal),
    tenge: String(ch.tenge)
  };
}

function FinanceCashflowChart({ points }: { points: FinancePeriodRow[] }) {
  const width = 900;
  const height = 270;
  const padding = 36;

  const maxValue = useMemo(() => {
    let m = 1;
    for (const p of points) {
      m = Math.max(m, Number(p.payment_sum), Number(p.debt_sum));
    }
    return m;
  }, [points]);

  const step = points.length <= 1 ? 0 : (width - padding * 2) / (points.length - 1);
  const scaleY = (value: number) =>
    height - padding - (value / maxValue) * (height - padding * 2);

  const debtPath = points
    .map((point, index) => {
      const x = padding + index * step;
      return `${index === 0 ? "M" : "L"} ${x} ${scaleY(Number(point.debt_sum))}`;
    })
    .join(" ");

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl bg-muted p-3 ring-1 ring-slate-100">
      <svg
        className="min-w-[760px]"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Оплаты и долги по периоду"
      >
        {[0, 1, 2, 3].map((line) => {
          const y = padding + line * ((height - padding * 2) / 3);
          return (
            <line
              key={line}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="#dbe3ea"
              strokeDasharray="5 8"
            />
          );
        })}
        {points.map((point, index) => {
          const x = padding + index * step;
          const income = Number(point.payment_sum);
          const barHeight = height - padding - scaleY(income);
          return (
            <g key={`${point.period}-${index}`}>
              <rect
                x={x - 14}
                y={scaleY(income)}
                width={28}
                height={Math.max(0, barHeight)}
                rx={8}
                fill="#14b8a6"
                opacity="0.82"
              />
            </g>
          );
        })}
        <path
          className="finance-chart-line"
          d={debtPath}
          fill="none"
          stroke="#ef4444"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={`debt-dot-${point.period}`}
            cx={padding + index * step}
            cy={scaleY(Number(point.debt_sum))}
            r="5"
            fill="#ef4444"
            stroke="white"
            strokeWidth="3"
          />
        ))}
        {points.map((point, index) => {
          const labelStride = points.length <= 20 ? 1 : Math.ceil(points.length / 20);
          const showLabel = index % labelStride === 0 || index === points.length - 1;
          if (!showLabel) return null;
          return (
            <text
              key={`label-${point.period}-${index}`}
              x={padding + index * step}
              y={height - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[12px] font-semibold"
            >
              {point.period}
            </text>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 px-2 text-sm font-semibold text-slate-600">
        <span className="flex items-center gap-2">
          <i className="h-3 w-3 rounded-sm bg-teal-500" />
          Оплаты
        </span>
        <span className="flex items-center gap-2">
          <i className="h-3 w-3 rounded-full bg-red-500" />
          Долг
        </span>
      </div>
    </div>
  );
}

export function FinancePeriodChart({ data }: { data: FinanceDashboardSnapshot }) {
  const granularity = data.period_granularity ?? "day";
  const periodBalance = resolvePeriodBalance(data);

  const points = useMemo(() => {
    const filled = fillFinancePeriodSeries(
      data.debt_and_payment_by_period,
      data.filters.from,
      data.filters.to,
      granularity
    );
    return filled.map((p) => ({
      ...p,
      period: formatFinancePeriodLabel(p.period, granularity)
    }));
  }, [data.debt_and_payment_by_period, data.filters.from, data.filters.to, granularity]);

  const sideItems = [
    { label: "UZS", value: periodBalance.uzs, wide: true },
    { label: "Pereches", value: periodBalance.transfer, wide: false },
    { label: "Tenge", value: periodBalance.tenge, wide: false },
    { label: "Terminal", value: periodBalance.terminal, wide: false },
    { label: "Naqd", value: periodBalance.cash, wide: false }
  ];

  return (
    <section className="finance-motion-fade rounded-2xl bg-card p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader
        title="Долги и оплаты по периодам"
        subtitle="Динамика оплат и задолженности за выбранный период"
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        {points.length === 0 ? (
          <p className="rounded-xl bg-muted px-2 py-12 text-center text-sm text-slate-500 ring-1 ring-slate-100">
            Нет данных за период
          </p>
        ) : (
          <FinanceCashflowChart points={points} />
        )}
        <div className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          {sideItems.map((item) => {
            const negative = Number(item.value) < 0;
            return (
              <div
                key={item.label}
                className={`rounded-xl bg-muted px-3 py-3 ring-1 ring-slate-100 ${
                  item.wide ? "sm:col-span-2 lg:col-span-1 2xl:col-span-2" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      negative ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                  />
                  <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                </div>
                <p
                  className={`mt-1 truncate text-[clamp(1rem,1.04vw,1.2rem)] font-black ${
                    negative ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {fmtFinanceMoney(item.value)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

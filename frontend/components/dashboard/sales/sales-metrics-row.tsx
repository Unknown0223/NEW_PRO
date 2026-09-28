"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { cn } from "@/lib/utils";
import { Activity, CircleDollarSign, CreditCard, RotateCcw, Wallet } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

const VALUE_MAX_PX = 24;
const VALUE_MIN_PX = 14;

const DEBT_BUCKET_LABELS: Record<
  NonNullable<SalesDashboardSnapshot["debt_aging"]>["buckets"][number]["key"],
  string
> = {
  d0_7: "До 7 дней",
  d8_14: "8–14 дней",
  d15_21: "15–21 день",
  d22_30: "22–30 дней",
  d30_plus: "Больше месяца"
};

function FitValue({ value, unit }: { value: string; unit?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    const fit = () => {
      let size = VALUE_MAX_PX;
      text.style.fontSize = `${size}px`;
      while (size > VALUE_MIN_PX && text.scrollWidth > box.clientWidth) {
        size -= 1;
        text.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [value, unit]);

  const full = unit ? `${value} ${unit}` : value;
  return (
    <div ref={boxRef} className="mt-2 min-w-0 overflow-hidden" title={full}>
      <span
        ref={textRef}
        className="inline-block max-w-full truncate whitespace-nowrap align-bottom font-bold leading-tight tracking-tight tabular-nums text-slate-950"
        style={{ fontSize: VALUE_MAX_PX }}
      >
        {value}
        {unit ? <span className="ml-1 text-[0.6em] font-semibold text-slate-400">{unit}</span> : null}
      </span>
    </div>
  );
}

type BreakdownRow = { label: string; sales_sum: string; share_pct: number };

function BreakdownBack({
  title,
  rows,
  barClass,
  emptyText = "Нет данных за период"
}: {
  title: string;
  rows: BreakdownRow[];
  barClass: string;
  emptyText?: string;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <RotateCcw className="h-4 w-4 text-slate-400" aria-hidden />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="-mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
          {rows.map((r) => (
            <li key={r.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-slate-600" title={r.label}>
                  {r.label}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-slate-950">
                  {fmtMoney(r.sales_sum)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn("h-full rounded-full", barClass)} style={{ width: `${r.share_pct}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                  {r.share_pct.toFixed(1)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const CARD_FACE = "min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm";

function MetricCard({
  title,
  value,
  unit,
  description,
  icon: Icon,
  tone,
  trend,
  back
}: {
  title: string;
  value: string;
  unit?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "teal" | "green" | "blue" | "red" | "amber";
  trend?: string;
  back?: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  const toneRing = {
    teal: "bg-teal-100 text-teal-700 ring-teal-200",
    green: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    blue: "bg-blue-100 text-blue-700 ring-blue-200",
    red: "bg-red-100 text-red-700 ring-red-200",
    amber: "bg-amber-100 text-amber-700 ring-amber-200"
  }[tone];

  const front = (
    <>
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
      <FitValue value={value} unit={unit} />
      <p className="mt-2 truncate text-sm text-slate-500" title={description}>{description}</p>
    </>
  );

  if (!back) {
    return (
      <div
        className={cn(
          CARD_FACE,
          "group transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-900/5"
        )}
      >
        {front}
      </div>
    );
  }

  const toggle = () => setFlipped((v) => !v);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      title={flipped ? "Нажмите, чтобы вернуться" : "Нажмите, чтобы увидеть детализацию"}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      className="group min-w-0 cursor-pointer rounded-2xl transition duration-300 [perspective:1200px] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
    >
      <div
        className={cn(
          "relative h-full transition-transform duration-500 [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]"
        )}
      >
        <div
          className={cn(
            CARD_FACE,
            "h-full [backface-visibility:hidden] group-hover:border-teal-200 group-hover:shadow-xl group-hover:shadow-teal-900/5"
          )}
          aria-hidden={flipped}
        >
          {front}
        </div>
        <div
          className={cn(
            CARD_FACE,
            "absolute inset-0 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)] group-hover:border-teal-200"
          )}
          aria-hidden={!flipped}
        >
          {back}
        </div>
      </div>
    </div>
  );
}

export function SalesMetricsRow({
  data,
  resolvePayment
}: {
  data: SalesDashboardSnapshot;
  resolvePayment: (ref: string) => string;
}) {
  const totalPayment = useMemo(
    () =>
      data.payment_method_analytics.reduce((s, r) => s + Math.max(0, Number(r.sales_sum)), 0),
    [data.payment_method_analytics]
  );
  const priceTypeRows = useMemo<BreakdownRow[]>(
    () =>
      (data.price_type_analytics ?? []).map((r) => ({
        label: r.price_type,
        sales_sum: r.sales_sum,
        share_pct: r.share_pct
      })),
    [data.price_type_analytics]
  );
  const paymentRows = useMemo<BreakdownRow[]>(() => {
    const byLabel = new Map<string, number>();
    for (const r of data.payment_method_analytics) {
      const label = r.payment_type === "—" ? "Не указано" : resolvePayment(r.payment_type);
      byLabel.set(label, (byLabel.get(label) ?? 0) + Number(r.sales_sum));
    }
    return [...byLabel.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, sum]) => ({
        label,
        sales_sum: String(sum),
        share_pct: totalPayment > 0 ? Math.min(100, Math.max(0, (sum / totalPayment) * 100)) : 0
      }));
  }, [data.payment_method_analytics, resolvePayment, totalPayment]);
  const debt = data.debt_aging;
  const debtRows = useMemo<BreakdownRow[]>(() => {
    if (!debt || Number(debt.total_debt) <= 0) return [];
    return debt.buckets.map((b) => ({
      label: DEBT_BUCKET_LABELS[b.key],
      sales_sum: b.sum,
      share_pct: b.share_pct
    }));
  }, [debt]);
  const { coverage_pct } = data.akb_okb_block;
  const refusalRate = Math.max(0, 100 - coverage_pct);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Общая сумма"
        value={fmtMoney(data.total_sales_summary.total_sales_sum)}
        unit="UZS"
        description="Сумма продаж за выбранный период"
        icon={CircleDollarSign}
        tone="teal"
        trend={`${coverage_pct.toFixed(1)}% ОКБ`}
        back={<BreakdownBack title="По типам цен" rows={priceTypeRows} barClass="bg-teal-500" />}
      />
      <MetricCard
        title="Payment Breakdown"
        value={fmtMoney(totalPayment)}
        unit="UZS"
        description="Сумма по способам оплаты"
        icon={CreditCard}
        tone="blue"
        back={<BreakdownBack title="По способам оплаты" rows={paymentRows} barClass="bg-blue-500" />}
      />
      <MetricCard
        title="Долг (дебиторка)"
        value={fmtMoney(debt?.total_debt ?? 0)}
        unit="UZS"
        description={`Должников: ${fmtCount(debt?.debtors_count ?? 0)} · на сегодня`}
        icon={Wallet}
        tone="amber"
        back={
          <BreakdownBack
            title="По срокам долга"
            rows={debtRows}
            barClass="bg-amber-500"
            emptyText="Долгов нет"
          />
        }
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

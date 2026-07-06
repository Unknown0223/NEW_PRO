"use client";

import { cn } from "@/lib/utils";
import { EnterprisePaymentKpiCard, type SupervisorPaymentSlot } from "./supervisor-enterprise-payment-card";

type VisitKpi = {
  visit_pct: number;
  planned_visits: number;
  visited_planned: number;
  success_pct: number;
  successful_visits: number;
  visited_total: number;
  gps_pct: number;
  gps_visits: number;
  photo_pct: number;
  photo_reports: number;
};

function visitKpiTone(pct: number, variant: "visit" | "success" | "gps" | "photo") {
  const v = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  if (variant === "gps") {
    return {
      border: "border-pink-300 dark:border-pink-500/50",
      bg: "bg-pink-50/80 dark:bg-pink-950/20",
      text: "text-pink-600 dark:text-pink-400"
    };
  }
  if (variant === "photo" || (variant === "success" && v >= 70)) {
    return {
      border: "border-emerald-300 dark:border-emerald-500/50",
      bg: "bg-emerald-50/80 dark:bg-emerald-950/20",
      text: "text-emerald-600 dark:text-emerald-400"
    };
  }
  if (v < 25) {
    return {
      border: "border-red-200 dark:border-red-500/40",
      bg: "bg-red-50/80 dark:bg-red-950/20",
      text: "text-red-500 dark:text-red-400"
    };
  }
  if (v < 60) {
    return {
      border: "border-amber-200 dark:border-amber-500/40",
      bg: "bg-amber-50/80 dark:bg-amber-950/20",
      text: "text-amber-600 dark:text-amber-400"
    };
  }
  return {
    border: "border-emerald-300 dark:border-emerald-500/50",
    bg: "bg-emerald-50/80 dark:bg-emerald-950/20",
    text: "text-emerald-600 dark:text-emerald-400"
  };
}

function EnterpriseVisitKpiCard({
  title,
  percent,
  planLabel,
  planValue,
  factLabel,
  factValue,
  variant
}: {
  title: string;
  percent: number;
  planLabel: string;
  planValue: string | number;
  factLabel: string;
  factValue: string | number;
  variant: "visit" | "success" | "gps" | "photo";
}) {
  const tone = visitKpiTone(percent, variant);
  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 transition-shadow hover:shadow-sm",
        tone.border,
        tone.bg
      )}
    >
      <p className="mb-1 line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">{title}</p>
      <p className={cn("mb-1.5 text-xl font-bold tabular-nums leading-none", tone.text)}>{percent}%</p>
      <div className="flex items-center justify-between gap-1 rounded-lg bg-muted/50 px-2 py-1 text-[10px]">
        <span className="tabular-nums text-muted-foreground">
          {planLabel} <span className="font-semibold text-foreground">{planValue}</span>
        </span>
        <span className="tabular-nums text-muted-foreground">
          {factLabel} <span className="font-semibold text-foreground">{factValue}</span>
        </span>
      </div>
    </div>
  );
}

/** Alohida oq blok — pastdagi bo‘limlar (`SupervisorEnterpriseSection`) bilan bir xil */
const KPI_BLOCK_SHELL =
  "flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card p-4 shadow-sm";

export function SupervisorEnterpriseKpiPanel({
  paymentSlots,
  visitKpi,
  salesPlanKpi,
  currency = "UZS"
}: {
  paymentSlots: SupervisorPaymentSlot[];
  visitKpi: VisitKpi;
  salesPlanKpi?: { planSum: string; factMtdSum: string; executionPct: number | null };
  currency?: string;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
      {salesPlanKpi ? (
        <div className={cn(KPI_BLOCK_SHELL, "lg:col-span-2")}>
          <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
            KPI план продаж (месяц)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">План (одобрено)</p>
              <p className="text-lg font-bold tabular-nums">{salesPlanKpi.planSum}</p>
            </div>
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Факт MTD</p>
              <p className="text-lg font-bold tabular-nums">{salesPlanKpi.factMtdSum}</p>
            </div>
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Выполнение</p>
              <p className="text-lg font-bold tabular-nums">
                {salesPlanKpi.executionPct != null ? `${salesPlanKpi.executionPct.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <div className={KPI_BLOCK_SHELL}>
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
          Продажи по способам оплаты
        </h3>
        {paymentSlots.length > 0 ? (
          <div className="grid flex-1 grid-cols-2 gap-2">
            {paymentSlots.map((slot, col) => {
              const payColorIdx = slot.isTotal ? 0 : Math.max(0, col - (paymentSlots[0]?.isTotal ? 1 : 0));
              return (
                <EnterprisePaymentKpiCard
                  key={slot.key}
                  slot={slot}
                  colorIndex={payColorIdx}
                  currency={currency}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Нет данных по оплате</p>
        )}
      </div>

      <div className={KPI_BLOCK_SHELL}>
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Визиты и отчёты</h3>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <EnterpriseVisitKpiCard
            title="Посещения (по визитам)"
            percent={visitKpi.visit_pct}
            planLabel="План"
            planValue={visitKpi.planned_visits}
            factLabel="Факт"
            factValue={visitKpi.visited_planned}
            variant="visit"
          />
          <EnterpriseVisitKpiCard
            title="Успешные визиты"
            percent={visitKpi.success_pct}
            planLabel="Визиты"
            planValue={visitKpi.visited_total}
            factLabel="Усп."
            factValue={visitKpi.successful_visits}
            variant="success"
          />
          <EnterpriseVisitKpiCard
            title="Посещения (по GPS)"
            percent={visitKpi.gps_pct}
            planLabel="План"
            planValue={visitKpi.planned_visits}
            factLabel="Факт"
            factValue={visitKpi.gps_visits}
            variant="gps"
          />
          <EnterpriseVisitKpiCard
            title="Фото отчёты"
            percent={visitKpi.photo_pct}
            planLabel="План"
            planValue={visitKpi.planned_visits}
            factLabel="Факт"
            factValue={visitKpi.photo_reports}
            variant="photo"
          />
        </div>
      </div>
    </section>
  );
}

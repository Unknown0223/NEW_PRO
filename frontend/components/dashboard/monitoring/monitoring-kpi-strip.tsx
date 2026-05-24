"use client";

import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { fmtCount, fmtMoney, formatMonthYearRu } from "@/components/dashboard/monitoring/utils";
import { SalesIconBadge } from "@/components/dashboard/sales/sales-section-panel";
import { cn } from "@/lib/utils";
import { Activity, Settings2, Store, Target, TrendingUp, Users } from "lucide-react";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  progress
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "teal" | "green" | "blue" | "amber";
  progress?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-500">{label}</div>
          <div className="mt-1 text-[22px] font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
        </div>
        <SalesIconBadge icon={Icon} tone={tone} />
      </div>
      {progress != null && Number.isFinite(progress) ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function MonitoringKpiStrip({
  data,
  month,
  year
}: {
  data: MonitoringSnapshot;
  month: number;
  year: number;
}) {
  const exec = data.plan_fact.execution_pct ?? 0;
  const coverage = data.akb_okb.coverage_pct;

  return (
    <section aria-label="KPI план и факт" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard label="План продаж" value={fmtMoney(data.plan_fact.plan_sales)} sub={formatMonthYearRu(month, year)} icon={Target} tone="teal" />
      <KpiCard
        label="Факт продаж"
        value={fmtMoney(data.plan_fact.fact_sales)}
        sub={exec != null ? `${exec.toFixed(0)}% выполнения` : "—"}
        icon={TrendingUp}
        tone="green"
      />
      <KpiCard
        label="Выполнение"
        value={data.plan_fact.execution_pct != null ? `${data.plan_fact.execution_pct.toFixed(0)}%` : "—"}
        sub="к плану"
        icon={Activity}
        tone="teal"
        progress={data.plan_fact.execution_pct ?? undefined}
      />
      <KpiCard label="ОКБ" value={fmtCount(data.akb_okb.okb)} sub="общая клиент. база" icon={Store} tone="blue" />
      <KpiCard label="АКБ" value={fmtCount(data.akb_okb.akb)} sub="активная база" icon={Users} tone="blue" />
      <KpiCard
        label="Конверсия"
        value={`${coverage.toFixed(0)}%`}
        sub="АКБ / ОКБ"
        icon={Settings2}
        tone="teal"
        progress={coverage}
      />
      {data.plan_fact.plan_note ? (
        <p className={cn("col-span-full text-xs text-muted-foreground")}>{data.plan_fact.plan_note}</p>
      ) : null}
    </section>
  );
}

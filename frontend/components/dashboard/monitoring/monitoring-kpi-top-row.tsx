"use client";

import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { fmtCount, fmtMoney } from "@/components/dashboard/monitoring/utils";

function ProgressBlock({ label, pct }: { label: string; pct: number | null }) {
  const width = pct != null && Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">{label}</p>
      <div className="h-6 overflow-hidden rounded-full bg-muted">
        <div
          className="flex h-full items-center justify-end rounded-full bg-emerald-500 pr-2"
          style={{ width: `${width}%`, minWidth: width > 0 ? "2.5rem" : undefined }}
        >
          <span className="text-xs font-medium text-white">{pct != null ? `${width.toFixed(0)}%` : "0%"}</span>
        </div>
      </div>
    </div>
  );
}

export function MonitoringSalesKpiCard({ data }: { data: MonitoringSnapshot }) {
  const exec = data.plan_fact.execution_pct;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">По продажам</h2>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-muted p-4 ring-1 ring-slate-100">
          <p className="mb-1 text-sm text-slate-500">План</p>
          <p className="text-2xl font-bold tabular-nums text-slate-800">{fmtMoney(data.plan_fact.plan_sales)}</p>
        </div>
        <div className="rounded-lg bg-muted p-4 ring-1 ring-slate-100">
          <p className="mb-1 text-sm text-slate-500">Факт</p>
          <p className="text-2xl font-bold tabular-nums text-slate-800">{fmtMoney(data.plan_fact.fact_sales)}</p>
        </div>
      </div>
      <ProgressBlock label="Выполнение плана продаж" pct={exec} />
      {data.plan_fact.plan_note ? (
        <p className="mt-3 text-xs text-muted-foreground">{data.plan_fact.plan_note}</p>
      ) : null}
    </div>
  );
}

export function MonitoringOkbAkbCard({ data }: { data: MonitoringSnapshot }) {
  const coverage = data.akb_okb.coverage_pct;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">ОКБ / АКБ</h2>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-muted p-4 ring-1 ring-slate-100">
          <p className="mb-1 text-sm text-slate-500">ОКБ</p>
          <p className="text-2xl font-bold tabular-nums text-slate-800">{fmtCount(data.akb_okb.okb)}</p>
        </div>
        <div className="rounded-lg bg-muted p-4 ring-1 ring-slate-100">
          <p className="mb-1 text-sm text-slate-500">АКБ</p>
          <p className="text-2xl font-bold tabular-nums text-slate-800">{fmtCount(data.akb_okb.akb)}</p>
        </div>
      </div>
      <ProgressBlock label="В процентах" pct={coverage} />
    </div>
  );
}

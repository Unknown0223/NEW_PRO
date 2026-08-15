"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { cn } from "@/lib/utils";
import type { DailyKpiAgentSummary, DailyKpiOverview } from "./daily-kpi-api";
import { fmtMoney, fmtPct, StatusBadge } from "./daily-kpi-format";

export function DailyKpiMonthTable({
  data,
  periodLabel,
  onPickDay
}: {
  data: DailyKpiOverview;
  periodLabel: string;
  onPickDay?: (ymd: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const agents = data.agents;
  const totals = data.totals;

  const exportExcel = async () => {
    setExporting(true);
    try {
      const headers = [
        "Агент",
        "Smart код",
        "Сегодня план",
        "Сегодня факт",
        "Сегодня %",
        "Сегодня остаток",
        "Месяц план",
        "Месяц факт",
        "Месяц %",
        "Раб. дни",
        "Осталось дн.",
        "Перенос",
        "Статус"
      ];
      const rows = agents.map((a) => [
        a.name,
        a.code ?? "",
        Math.round(a.today_plan_sum),
        Math.round(a.today_fact_sum),
        a.today_execution_pct ?? "",
        Math.round(a.today_remaining_sum),
        Math.round(a.month_plan_sum),
        Math.round(a.month_fact_sum),
        a.month_execution_pct ?? "",
        a.working_days_total,
        a.remaining_working_days,
        Math.round(a.carry_forward_sum),
        a.status
      ]);
      rows.push([
        `Итого (${agents.length})`,
        "",
        Math.round(totals.today_plan_sum),
        Math.round(totals.today_fact_sum),
        totals.today_execution_pct ?? "",
        "",
        Math.round(totals.month_plan_sum),
        Math.round(totals.month_fact_sum),
        totals.month_execution_pct ?? "",
        "",
        "",
        "",
        ""
      ]);
      await downloadXlsxSheet(`daily-kpi-month-${data.period.month}.xlsx`, "Месяц", headers, rows, {
        colWidths: [22, 12, 14, 14, 10, 14, 14, 14, 10, 10, 12, 12, 14]
      });
    } catch (e) {
      console.error(e);
      window.alert("Не удалось выгрузить Excel.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Месяц · агенты
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            {periodLabel} · carry-forward по рабочим дням
          </h2>
        </div>
        <button
          type="button"
          disabled={exporting || agents.length === 0}
          onClick={() => void exportExcel()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="size-3.5" />
          )}
          Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Агент</th>
              <th className="px-3 py-2 text-left">Smart код</th>
              <th className="px-2 py-2 text-right">Сегодня план</th>
              <th className="px-2 py-2 text-right">Сегодня факт</th>
              <th className="px-2 py-2 text-right">Сегодня %</th>
              <th className="px-2 py-2 text-right">Остаток</th>
              <th className="border-l border-slate-200 px-2 py-2 text-right">Месяц план</th>
              <th className="px-2 py-2 text-right">Месяц факт</th>
              <th className="px-2 py-2 text-right">Месяц %</th>
              <th className="border-l border-slate-200 px-2 py-2 text-right">Раб. дни</th>
              <th className="px-2 py-2 text-right">Осталось</th>
              <th className="px-2 py-2 text-right">Перенос</th>
              <th className="px-3 py-2 text-left">Статус</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-slate-500">
                  Нет агентов с планом на этот месяц
                </td>
              </tr>
            ) : (
              agents.map((a) => (
                <MonthRow
                  key={a.agent_id}
                  agent={a}
                  todayYmd={data.period.today}
                  onPickDay={onPickDay}
                />
              ))
            )}
          </tbody>
          {agents.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Итого</td>
                <td className="px-3 py-2" />
                <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(totals.today_plan_sum)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(totals.today_fact_sum)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtPct(totals.today_execution_pct)}</td>
                <td className="px-2 py-2" />
                <td className="border-l border-slate-200 px-2 py-2 text-right tabular-nums">
                  {fmtMoney(totals.month_plan_sum)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(totals.month_fact_sum)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtPct(totals.month_execution_pct)}</td>
                <td colSpan={4} className="border-l border-slate-200 px-3 py-2 text-[11px] font-normal text-slate-500">
                  {totals.done} выполнено · {totals.warn} частично · {totals.pending} ожидается ·{" "}
                  {totals.over} перевып.
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function MonthRow({
  agent,
  todayYmd,
  onPickDay
}: {
  agent: DailyKpiAgentSummary;
  todayYmd: string;
  onPickDay?: (ymd: string) => void;
}) {
  const clickable = Boolean(onPickDay);
  return (
    <tr
      className={cn(
        "border-b border-slate-100",
        clickable && "cursor-pointer hover:bg-teal-50/40"
      )}
      onClick={() => onPickDay?.(todayYmd)}
    >
      <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-800">{agent.name}</td>
      <td className="px-3 py-2 tabular-nums text-slate-600">{agent.code ?? "—"}</td>
      <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(agent.today_plan_sum)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(agent.today_fact_sum)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{fmtPct(agent.today_execution_pct)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-amber-800">
        {agent.today_remaining_sum > 0 ? fmtMoney(agent.today_remaining_sum) : "—"}
      </td>
      <td className="border-l border-slate-100 px-2 py-2 text-right tabular-nums">
        {fmtMoney(agent.month_plan_sum)}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(agent.month_fact_sum)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{fmtPct(agent.month_execution_pct)}</td>
      <td className="border-l border-slate-100 px-2 py-2 text-right tabular-nums">
        {agent.working_days_total}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{agent.remaining_working_days}</td>
      <td className="px-2 py-2 text-right tabular-nums">
        {agent.carry_forward_sum > 0 ? fmtMoney(agent.carry_forward_sum) : "—"}
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={agent.status} />
      </td>
    </tr>
  );
}

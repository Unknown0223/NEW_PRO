"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, Loader2, Search, X } from "lucide-react";
import { usePermissions } from "@/lib/use-permissions";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { cn } from "@/lib/utils";
import type { DailyKpiAgentSummary } from "./daily-kpi-api";
import { fmtMoney, fmtPct, StatusBadge, statusLabel } from "./daily-kpi-format";
import {
  buildDailyKpiRows,
  EMPTY_DAILY_KPI_FILTERS,
  sortDailyKpiRows,
  type DailyKpiMonthFilters,
  type DailyKpiMonthRow,
  type DailyKpiMonthTotals,
  type DailyKpiSort,
  type DailyKpiSortKey,
  type DailyKpiViewMode
} from "./daily-kpi-month-view";

type Column = {
  key: DailyKpiSortKey;
  label: string;
  align: "left" | "right";
  divider?: boolean;
  sticky?: boolean;
  render: (r: DailyKpiMonthRow) => ReactNode;
  excel: (r: DailyKpiMonthRow) => string | number;
  excelWidth: number;
  total?: (t: DailyKpiMonthTotals) => ReactNode;
  excelTotal?: (t: DailyKpiMonthTotals) => string | number;
};

const money = (v: number) => Math.round(v);
const dash = (v: number) => (v > 0 ? fmtMoney(v) : "—");

const METRIC_COLUMNS: Column[] = [
  {
    key: "today_plan_sum",
    label: "Сегодня план",
    align: "right",
    divider: true,
    render: (r) => fmtMoney(r.today_plan_sum),
    excel: (r) => money(r.today_plan_sum),
    excelWidth: 14,
    total: (t) => fmtMoney(t.today_plan_sum),
    excelTotal: (t) => money(t.today_plan_sum)
  },
  {
    key: "today_fact_sum",
    label: "Сегодня факт",
    align: "right",
    render: (r) => fmtMoney(r.today_fact_sum),
    excel: (r) => money(r.today_fact_sum),
    excelWidth: 14,
    total: (t) => fmtMoney(t.today_fact_sum),
    excelTotal: (t) => money(t.today_fact_sum)
  },
  {
    key: "today_execution_pct",
    label: "Сегодня %",
    align: "right",
    render: (r) => fmtPct(r.today_execution_pct),
    excel: (r) => r.today_execution_pct ?? "",
    excelWidth: 10,
    total: (t) => fmtPct(t.today_execution_pct),
    excelTotal: (t) => t.today_execution_pct ?? ""
  },
  {
    key: "today_remaining_sum",
    label: "Остаток",
    align: "right",
    render: (r) => <span className="text-amber-800">{dash(r.today_remaining_sum)}</span>,
    excel: (r) => money(r.today_remaining_sum),
    excelWidth: 14,
    total: (t) => dash(t.today_remaining_sum),
    excelTotal: (t) => money(t.today_remaining_sum)
  },
  {
    key: "month_plan_sum",
    label: "Месяц план",
    align: "right",
    divider: true,
    render: (r) => fmtMoney(r.month_plan_sum),
    excel: (r) => money(r.month_plan_sum),
    excelWidth: 14,
    total: (t) => fmtMoney(t.month_plan_sum),
    excelTotal: (t) => money(t.month_plan_sum)
  },
  {
    key: "month_fact_sum",
    label: "Месяц факт",
    align: "right",
    render: (r) => fmtMoney(r.month_fact_sum),
    excel: (r) => money(r.month_fact_sum),
    excelWidth: 14,
    total: (t) => fmtMoney(t.month_fact_sum),
    excelTotal: (t) => money(t.month_fact_sum)
  },
  {
    key: "month_execution_pct",
    label: "Месяц %",
    align: "right",
    render: (r) => fmtPct(r.month_execution_pct),
    excel: (r) => r.month_execution_pct ?? "",
    excelWidth: 10,
    total: (t) => fmtPct(t.month_execution_pct),
    excelTotal: (t) => t.month_execution_pct ?? ""
  },
  {
    key: "working_days_total",
    label: "Раб. дни",
    align: "right",
    divider: true,
    render: (r) => r.working_days_total,
    excel: (r) => r.working_days_total,
    excelWidth: 10
  },
  {
    key: "remaining_working_days",
    label: "Осталось",
    align: "right",
    render: (r) => r.remaining_working_days,
    excel: (r) => r.remaining_working_days,
    excelWidth: 10
  },
  {
    key: "carry_forward_sum",
    label: "Перенос",
    align: "right",
    render: (r) => dash(r.carry_forward_sum),
    excel: (r) => money(r.carry_forward_sum),
    excelWidth: 14,
    total: (t) => dash(t.carry_forward_sum),
    excelTotal: (t) => money(t.carry_forward_sum)
  },
  {
    key: "status",
    label: "Статус",
    align: "left",
    render: (r) => <StatusBadge status={r.status} />,
    excel: (r) => statusLabel(r.status),
    excelWidth: 14
  }
];

const AGENTS_COUNT_COLUMN: Column = {
  key: "agents_count",
  label: "Агентов",
  align: "right",
  render: (r) => r.agents_count,
  excel: (r) => r.agents_count,
  excelWidth: 10,
  total: (t) => t.agents,
  excelTotal: (t) => t.agents
};

function leadColumns(mode: DailyKpiViewMode): Column[] {
  if (mode === "branches") {
    return [
      {
        key: "name",
        label: "Филиал",
        align: "left",
        sticky: true,
        render: (r) => r.name,
        excel: (r) => r.name,
        excelWidth: 24
      },
      AGENTS_COUNT_COLUMN
    ];
  }
  if (mode === "supervisors") {
    return [
      {
        key: "name",
        label: "Супервайзер",
        align: "left",
        sticky: true,
        render: (r) => r.name,
        excel: (r) => r.name,
        excelWidth: 24
      },
      {
        key: "branch",
        label: "Филиал",
        align: "left",
        render: (r) => r.branch || "—",
        excel: (r) => r.branch,
        excelWidth: 20
      },
      AGENTS_COUNT_COLUMN
    ];
  }
  return [
    {
      key: "name",
      label: "Агент",
      align: "left",
      sticky: true,
      render: (r) => r.name,
      excel: (r) => r.name,
      excelWidth: 24
    },
    {
      key: "code",
      label: "Smart код",
      align: "left",
      render: (r) => r.code ?? "—",
      excel: (r) => r.code ?? "",
      excelWidth: 12
    },
    {
      key: "branch",
      label: "Филиал",
      align: "left",
      render: (r) => r.branch,
      excel: (r) => r.branch,
      excelWidth: 18
    },
    {
      key: "supervisor",
      label: "Супервайзер",
      align: "left",
      render: (r) => r.supervisor,
      excel: (r) => r.supervisor,
      excelWidth: 22
    }
  ];
}

const MODE_OPTIONS: Array<{ id: DailyKpiViewMode; label: string }> = [
  { id: "agents", label: "Агенты" },
  { id: "supervisors", label: "Супервайзеры" },
  { id: "branches", label: "Филиалы" }
];

const MODE_TITLE: Record<DailyKpiViewMode, string> = {
  agents: "Месяц · агенты",
  supervisors: "Месяц · супервайзеры",
  branches: "Месяц · филиалы"
};

export function DailyKpiMonthTable({
  agents,
  totalAgents,
  totals,
  periodLabel,
  monthNum,
  todayYmd,
  mode,
  onModeChange,
  filters,
  onFiltersChange,
  options,
  onPickDay
}: {
  agents: DailyKpiAgentSummary[];
  totalAgents: number;
  totals: DailyKpiMonthTotals;
  periodLabel: string;
  monthNum: number;
  todayYmd: string;
  mode: DailyKpiViewMode;
  onModeChange: (mode: DailyKpiViewMode) => void;
  filters: DailyKpiMonthFilters;
  onFiltersChange: (next: DailyKpiMonthFilters) => void;
  options: { branches: string[]; supervisors: string[]; statuses: string[] };
  onPickDay?: (ymd: string) => void;
}) {
  const canExport = usePermissions().has("reports.dnevnye_kpi_plany.export");
  const [exporting, setExporting] = useState(false);
  const [sort, setSort] = useState<DailyKpiSort>({ key: "name", dir: "asc" });

  const columns = useMemo(() => [...leadColumns(mode), ...METRIC_COLUMNS], [mode]);
  const rows = useMemo(
    () => sortDailyKpiRows(buildDailyKpiRows(agents, mode), sort),
    [agents, mode, sort]
  );
  const activeKey = columns.some((c) => c.key === sort.key) ? sort.key : "name";
  const filtersActive =
    filters.search.trim() !== "" || filters.branch !== "" || filters.supervisor !== "" || filters.status !== "";

  const toggleSort = (key: DailyKpiSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "code" || key === "branch" || key === "supervisor" ? "asc" : "desc" }
    );
  };

  const setFilter = (patch: Partial<DailyKpiMonthFilters>) => onFiltersChange({ ...filters, ...patch });

  const drillDown = (r: DailyKpiMonthRow) => {
    if (r.kind === "agents") {
      onPickDay?.(todayYmd);
      return;
    }
    onFiltersChange(
      r.kind === "branches" ? { ...filters, branch: r.name } : { ...filters, supervisor: r.name }
    );
    onModeChange("agents");
  };

  const leadCount = leadColumns(mode).length;
  const firstTotalIdx = columns.findIndex((c) => c.total != null);
  const labelSpan = firstTotalIdx > 0 ? firstTotalIdx : leadCount;

  const exportExcel = async () => {
    setExporting(true);
    try {
      const headers = columns.map((c) => c.label);
      const body = rows.map((r) => columns.map((c) => c.excel(r)));
      body.push(
        columns.map((c, i) =>
          i === 0 ? `Итого (${rows.length})` : c.excelTotal ? c.excelTotal(totals) : ""
        )
      );
      await downloadXlsxSheet(
        `daily-kpi-month-${monthNum}-${mode}.xlsx`,
        MODE_OPTIONS.find((m) => m.id === mode)?.label ?? "Месяц",
        headers,
        body,
        { colWidths: columns.map((c) => c.excelWidth) }
      );
    } catch (e) {
      console.error(e);
      window.alert("Не удалось выгрузить Excel.");
    } finally {
      setExporting(false);
    }
  };

  const selectCls =
    "h-8 max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-teal-500";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-3">
        <div className="shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {MODE_TITLE[mode]}
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            {periodLabel} · carry-forward по рабочим дням
          </h2>
        </div>

        <div className="order-3 flex w-full min-w-0 flex-wrap items-center gap-2 2xl:order-none 2xl:w-auto 2xl:flex-1 2xl:justify-center">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => onModeChange(m.id)}
                className={cn(
                  "h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition",
                  mode === m.id ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              placeholder="Поиск: агент, код…"
              className="h-8 w-[170px] rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 outline-none focus:border-teal-500"
            />
          </label>

          <select
            value={filters.branch}
            onChange={(e) => setFilter({ branch: e.target.value })}
            className={selectCls}
            aria-label="Филиал"
          >
            <option value="">Все филиалы</option>
            {options.branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={filters.supervisor}
            onChange={(e) => setFilter({ supervisor: e.target.value })}
            className={selectCls}
            aria-label="Супервайзер"
          >
            <option value="">Все супервайзеры</option>
            {options.supervisors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value })}
            className={selectCls}
            aria-label="Статус"
          >
            <option value="">Все статусы</option>
            {options.statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>

          {filtersActive ? (
            <button
              type="button"
              onClick={() => onFiltersChange(EMPTY_DAILY_KPI_FILTERS)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              <X className="size-3.5" />
              Сброс
            </button>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {filtersActive ? (
            <span className="text-[11px] text-slate-500">
              {agents.length} из {totalAgents}
            </span>
          ) : null}
          {canExport ? (
            <button
              type="button"
              disabled={exporting || rows.length === 0}
              onClick={() => void exportExcel()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
              Excel
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {columns.map((c) => {
                const active = activeKey === c.key;
                const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "px-2 py-2",
                      c.align === "right" ? "text-right" : "text-left",
                      c.sticky && "sticky left-0 z-10 bg-slate-50 px-3",
                      c.divider && "border-l border-slate-200"
                    )}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap uppercase hover:text-slate-800",
                        c.align === "right" && "flex-row-reverse",
                        active && "text-teal-700"
                      )}
                    >
                      {c.label}
                      <Icon className={cn("size-3 shrink-0", !active && "opacity-40")} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                  {totalAgents === 0 ? "Нет агентов с планом на этот месяц" : "Нет данных по выбранным фильтрам"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.key}
                  className="cursor-pointer border-b border-slate-100 hover:bg-teal-50/40"
                  onClick={() => drillDown(r)}
                  title={r.kind === "agents" ? undefined : "Показать агентов"}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-2 py-2",
                        c.align === "right" ? "text-right tabular-nums" : "text-left",
                        c.sticky && "sticky left-0 z-10 bg-white px-3 font-medium text-slate-800",
                        !c.sticky && c.align === "left" && "text-slate-600",
                        c.divider && "border-l border-slate-100"
                      )}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td colSpan={labelSpan} className="sticky left-0 z-10 bg-slate-50 px-3 py-2">
                  {mode === "agents" ? `Итого (${totals.agents} агент.)` : `Итого (${rows.length})`}
                </td>
                {columns.slice(labelSpan).map((c) =>
                  c.key === "working_days_total" ? (
                    <td
                      key={c.key}
                      colSpan={4}
                      className="border-l border-slate-200 px-3 py-2 text-[11px] font-normal text-slate-500"
                    >
                      {totals.done} выполнено · {totals.warn} частично · {totals.pending} ожидается ·{" "}
                      {totals.over} перевып. · {totals.off} выходной · {totals.no_plan} без плана
                    </td>
                  ) : c.key === "remaining_working_days" || c.key === "carry_forward_sum" || c.key === "status" ? null : (
                    <td
                      key={c.key}
                      className={cn(
                        "px-2 py-2 text-right tabular-nums",
                        c.divider && "border-l border-slate-200"
                      )}
                    >
                      {c.total ? c.total(totals) : null}
                    </td>
                  )
                )}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

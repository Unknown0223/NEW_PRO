"use client";

import { useEffect, useMemo, useState } from "react";
import { Columns3, FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadXlsxAoa } from "@/lib/download-xlsx";
import { cn } from "@/lib/utils";
import type { DailyKpiDayMatrix } from "./daily-kpi-api";
import { fmtMoney, fmtPct } from "./daily-kpi-format";

type MetricKey = "day_plan" | "sales" | "returns" | "fact" | "execution_pct";

const ALL_METRICS: Array<{ key: MetricKey; label: string; short: string }> = [
  { key: "day_plan", label: "План", short: "План" },
  { key: "sales", label: "Продажа", short: "Прод" },
  { key: "returns", label: "Возврат", short: "Возвр" },
  { key: "fact", label: "Факт", short: "Факт" },
  { key: "execution_pct", label: "%", short: "%" }
];

const IDENTITY_COLS = 3; // Агент · Smart код · Филиал
const STORAGE_KEY = "daily-kpi-visible-metrics";

type VisibleMetrics = Record<MetricKey, boolean>;

const DEFAULT_VISIBLE: VisibleMetrics = {
  day_plan: true,
  sales: true,
  returns: true,
  fact: true,
  execution_pct: true
};

function loadVisible(): VisibleMetrics {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE;
    const parsed = JSON.parse(raw) as Partial<VisibleMetrics>;
    return { ...DEFAULT_VISIBLE, ...parsed };
  } catch {
    return DEFAULT_VISIBLE;
  }
}

function cellValue(
  c: { day_plan: number; sales: number; returns: number; fact: number; execution_pct: number | null } | undefined,
  key: MetricKey
): number | null {
  if (!c) return key === "execution_pct" ? null : 0;
  return c[key];
}

export function DailyKpiDayTable({
  data,
  dayLabel
}: {
  data: DailyKpiDayMatrix;
  dayLabel: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [visible, setVisible] = useState<VisibleMetrics>(DEFAULT_VISIBLE);

  useEffect(() => {
    setVisible(loadVisible());
  }, []);

  const groups = data.kpi_groups;
  const agents = data.agents;

  const activeMetrics = useMemo(
    () => ALL_METRICS.filter((m) => visible[m.key]),
    [visible]
  );

  const footerCells = useMemo(() => {
    const out: Record<string, { day_plan: number; sales: number; returns: number; fact: number }> =
      {};
    for (const g of groups) {
      const id = String(g.kpi_group_id);
      out[id] = { day_plan: 0, sales: 0, returns: 0, fact: 0 };
    }
    for (const a of agents) {
      for (const g of groups) {
        const id = String(g.kpi_group_id);
        const c = a.cells[id];
        if (!c || !out[id]) continue;
        out[id].day_plan += c.day_plan;
        out[id].sales += c.sales;
        out[id].returns += c.returns;
        out[id].fact += c.fact;
      }
    }
    return out;
  }, [agents, groups]);

  const setMetricVisible = (key: MetricKey, on: boolean) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: on };
      // Kamida bitta metric ochiq qolsin
      if (!ALL_METRICS.some((m) => next[m.key])) return prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const metrics = activeMetrics.length > 0 ? activeMetrics : ALL_METRICS;
      const metricCount = metrics.length;
      const header1: (string | number)[] = ["Агент", "Smart код", "Филиал"];
      const header2: (string | number)[] = ["", "", ""];
      const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }
      ];

      let col = IDENTITY_COLS;
      for (const g of groups) {
        header1.push(g.name);
        for (let i = 1; i < metricCount; i++) header1.push("");
        for (const m of metrics) header2.push(m.label);
        if (metricCount > 1) {
          merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + metricCount - 1 } });
        }
        col += metricCount;
      }

      const dataRows = agents.map((a) => {
        const line: (string | number)[] = [a.name, a.code ?? "", a.branch ?? ""];
        for (const g of groups) {
          const c = a.cells[String(g.kpi_group_id)];
          for (const m of metrics) {
            const raw = cellValue(c, m.key);
            if (m.key === "execution_pct") {
              line.push(raw == null ? "" : Math.round(raw * 10) / 10);
            } else {
              line.push(Math.round(raw ?? 0));
            }
          }
        }
        return line;
      });

      const totalLine: (string | number)[] = [`Итого (${agents.length})`, "", ""];
      for (const g of groups) {
        const t = footerCells[String(g.kpi_group_id)];
        const plan = t?.day_plan ?? 0;
        const fact = t?.fact ?? 0;
        const pct = plan > 0 ? Math.round((fact / plan) * 1000) / 10 : null;
        for (const m of metrics) {
          if (m.key === "day_plan") totalLine.push(Math.round(plan));
          else if (m.key === "sales") totalLine.push(Math.round(t?.sales ?? 0));
          else if (m.key === "returns") totalLine.push(Math.round(t?.returns ?? 0));
          else if (m.key === "fact") totalLine.push(Math.round(fact));
          else totalLine.push(pct ?? "");
        }
      }

      const colWidths = [
        22,
        14,
        16,
        ...groups.flatMap(() => metrics.map((m) => (m.key === "execution_pct" ? 8 : 12)))
      ];

      await downloadXlsxAoa(
        `daily-kpi-${data.day}.xlsx`,
        "KPI день",
        [header1, header2, ...dataRows, totalLine],
        { colWidths, merges }
      );
    } catch (e) {
      console.error(e);
      window.alert("Не удалось выгрузить Excel. Обновите страницу и попробуйте снова.");
    } finally {
      setExporting(false);
    }
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center text-sm text-slate-500">
        Нет KPI планов на выбранный день / направление
      </div>
    );
  }

  const stickyLeft = ["0", "10rem", "16.5rem"] as const;
  const stickyWidths = ["10rem", "6.5rem", "7.5rem"] as const;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-600">
            KPI · день
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            Агенты × группы · {dayLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setColsOpen((o) => !o)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Колонки метрик"
            >
              <Columns3 className="size-3.5" />
              Колонки
            </button>
            {colsOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  aria-label="Закрыть"
                  onClick={() => setColsOpen(false)}
                />
                <div className="absolute right-0 z-40 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  <p className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Показать в таблице
                  </p>
                  {ALL_METRICS.map((m) => (
                    <label
                      key={m.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={visible[m.key]}
                        onChange={(e) => setMetricVisible(m.key, e.target.checked)}
                        className="size-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      {m.label}
                    </label>
                  ))}
                  <p className="mt-1 border-t border-slate-100 px-1.5 pt-1.5 text-[10px] leading-snug text-slate-400">
                    Скрытые колонки не показываются, но участвуют в расчёте % и итогов
                  </p>
                </div>
              </>
            ) : null}
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
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              {(
                [
                  { label: "Агент", i: 0 },
                  { label: "Smart код", i: 1 },
                  { label: "Филиал", i: 2 }
                ] as const
              ).map((col) => (
                <th
                  key={col.label}
                  rowSpan={2}
                  style={{ left: stickyLeft[col.i], minWidth: stickyWidths[col.i] }}
                  className="sticky z-20 border-r border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600"
                >
                  {col.label}
                </th>
              ))}
              {groups.map((g) => (
                <th
                  key={g.kpi_group_id}
                  colSpan={Math.max(activeMetrics.length, 1)}
                  className="border-r border-slate-200 px-2 py-2 text-center text-[11px] font-semibold text-slate-800"
                >
                  {g.name}
                  {g.code ? (
                    <span className="ml-1 font-normal text-slate-400">({g.code})</span>
                  ) : null}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              {groups.map((g) =>
                activeMetrics.map((m, idx) => (
                  <th
                    key={`${g.kpi_group_id}-${m.key}`}
                    className={cn(
                      "whitespace-nowrap px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-500",
                      idx === activeMetrics.length - 1 && "border-r border-slate-200"
                    )}
                  >
                    {m.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td
                  colSpan={IDENTITY_COLS + groups.length * Math.max(activeMetrics.length, 1)}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  Нет агентов с планом
                </td>
              </tr>
            ) : (
              agents.map((a) => (
                <tr key={a.agent_id} className="border-b border-slate-100 hover:bg-teal-50/30">
                  <td
                    style={{ left: stickyLeft[0], minWidth: stickyWidths[0] }}
                    className="sticky z-10 border-r border-slate-100 bg-white px-3 py-2 font-medium text-slate-800"
                  >
                    {a.name}
                  </td>
                  <td
                    style={{ left: stickyLeft[1], minWidth: stickyWidths[1] }}
                    className="sticky z-10 border-r border-slate-100 bg-white px-3 py-2 tabular-nums text-slate-600"
                  >
                    {a.code ?? "—"}
                  </td>
                  <td
                    style={{ left: stickyLeft[2], minWidth: stickyWidths[2] }}
                    className="sticky z-10 border-r border-slate-100 bg-white px-3 py-2 text-slate-600"
                  >
                    {a.branch?.trim() ? a.branch : "—"}
                  </td>
                  {groups.map((g) => {
                    const c = a.cells[String(g.kpi_group_id)];
                    return activeMetrics.map((m, idx) => {
                      const raw = cellValue(c, m.key);
                      const display =
                        m.key === "execution_pct"
                          ? fmtPct(typeof raw === "number" ? raw : null)
                          : fmtMoney(typeof raw === "number" ? raw : 0);
                      return (
                        <td
                          key={`${a.agent_id}-${g.kpi_group_id}-${m.key}`}
                          className={cn(
                            "whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700",
                            idx === activeMetrics.length - 1 && "border-r border-slate-100",
                            m.key === "execution_pct" && "font-medium",
                            m.key === "fact" && "text-slate-900",
                            m.key === "returns" && (c?.returns ?? 0) > 0 && "text-rose-700"
                          )}
                        >
                          {display}
                        </td>
                      );
                    });
                  })}
                </tr>
              ))
            )}
          </tbody>
          {agents.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td
                  style={{ left: stickyLeft[0], minWidth: stickyWidths[0] }}
                  className="sticky z-10 border-r border-slate-200 bg-slate-50 px-3 py-2 text-slate-800"
                >
                  Итого
                </td>
                <td
                  style={{ left: stickyLeft[1], minWidth: stickyWidths[1] }}
                  className="sticky z-10 border-r border-slate-200 bg-slate-50 px-3 py-2"
                />
                <td
                  style={{ left: stickyLeft[2], minWidth: stickyWidths[2] }}
                  className="sticky z-10 border-r border-slate-200 bg-slate-50 px-3 py-2"
                />
                {groups.map((g) => {
                  const t = footerCells[String(g.kpi_group_id)];
                  const plan = t?.day_plan ?? 0;
                  const fact = t?.fact ?? 0;
                  const pct = plan > 0 ? (fact / plan) * 100 : null;
                  const bag: Record<MetricKey, number | null> = {
                    day_plan: plan,
                    sales: t?.sales ?? 0,
                    returns: t?.returns ?? 0,
                    fact,
                    execution_pct: pct
                  };
                  return activeMetrics.map((m, idx) => (
                    <td
                      key={`t-${g.kpi_group_id}-${m.key}`}
                      className={cn(
                        "whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800",
                        idx === activeMetrics.length - 1 && "border-r border-slate-200"
                      )}
                    >
                      {m.key === "execution_pct"
                        ? fmtPct(bag[m.key])
                        : fmtMoney(bag[m.key] ?? 0)}
                    </td>
                  ));
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

"use client";

import { MonitoringExecutionBar } from "@/components/dashboard/monitoring/monitoring-execution-bar";
import { MonitoringTablePager } from "@/components/dashboard/monitoring/monitoring-table-pager";
import type { MonitoringSnapshot, PerformanceTab } from "@/components/dashboard/monitoring/types";
import { fmtCount, fmtMoney } from "@/components/dashboard/monitoring/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";

export function MonitoringPerformanceTabs({
  data,
  branchTotal,
  supervisorTotal,
  branchPage,
  branchPageSize,
  onBranchPageChange,
  onBranchPageSizeChange,
  supervisorPage,
  supervisorPageSize,
  onSupervisorPageChange,
  onSupervisorPageSizeChange
}: {
  data: MonitoringSnapshot;
  branchTotal: number;
  supervisorTotal: number;
  branchPage: number;
  branchPageSize: number;
  onBranchPageChange: (p: number) => void;
  onBranchPageSizeChange: (s: number) => void;
  supervisorPage: number;
  supervisorPageSize: number;
  onSupervisorPageChange: (p: number) => void;
  onSupervisorPageSizeChange: (s: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<PerformanceTab>("branches");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const tabs = useMemo(
    () => [
      { id: "branches" as const, label: "По филиалам", count: branchTotal },
      { id: "supervisors" as const, label: "По супервайзерам", count: supervisorTotal },
      { id: "directions" as const, label: "По направлениям торговли", count: data.trade_directions.length }
    ],
    [branchTotal, supervisorTotal, data.trade_directions.length]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (activeTab === "branches") {
      return data.branch_performance
        .filter((r) => !q || r.branch.toLowerCase().includes(q))
        .map((r) => ({
          key: r.branch,
          name: r.branch,
          akb: r.akb,
          plan: r.plan_sales,
          fact: r.fact_sales,
          execution: r.execution_pct
        }));
    }
    if (activeTab === "supervisors") {
      return data.supervisor_performance
        .filter((r) => !q || r.supervisor_name.toLowerCase().includes(q))
        .map((r) => ({
          key: String(r.supervisor_id ?? r.supervisor_name),
          name: r.supervisor_name,
          akb: r.akb,
          plan: r.plan_sales,
          fact: r.fact_sales,
          execution: r.execution_pct
        }));
    }
    return data.trade_directions
      .filter((r) => !q || r.direction.toLowerCase().includes(q))
      .map((r) => ({
        key: r.direction,
        name: r.direction,
        akb: null as number | null,
        plan: "—",
        fact: r.sales_sum,
        execution: r.share_pct
      }));
  }, [activeTab, data, search]);

  const useServerPager = activeTab === "branches" || activeTab === "supervisors";
  const total = useServerPager
    ? activeTab === "branches"
      ? branchTotal
      : supervisorTotal
    : rows.length;
  const totalPages = Math.max(1, Math.ceil(total / (useServerPager ? (activeTab === "branches" ? branchPageSize : supervisorPageSize) : pageSize)));
  const safePage = useServerPager
    ? activeTab === "branches"
      ? branchPage
      : supervisorPage
    : Math.min(page, totalPages - 1);

  const visibleRows = useServerPager
    ? rows
    : rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const switchTab = (id: PerformanceTab) => {
    setActiveTab(id);
    setSearch("");
    setPage(0);
  };

  return (
    <section className="sales-dashboard-panel sales-motion-slide-up overflow-hidden p-0">
      <div className="border-b border-slate-100 px-4 pt-3">
        <div className="flex flex-wrap items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={cn(
                "-mb-px border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
                activeTab === tab.id
                  ? "border-teal-600 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}{" "}
              <span
                className={cn(
                  "ml-1.5 rounded-md px-1.5 py-0.5 text-[11px]",
                  activeTab === tab.id ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Поиск"
              className="h-8 w-[220px] pl-7 text-xs"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="ml-auto h-8 w-8 p-0" onClick={() => setSearch("")}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500 backdrop-blur">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Название</th>
                <th className="w-[110px] px-3 py-2.5 text-right font-medium">АКБ</th>
                <th className="w-[130px] px-3 py-2.5 text-right font-medium">План</th>
                <th className="w-[130px] px-3 py-2.5 text-right font-medium">Факт</th>
                <th className="w-[160px] px-3 py-2.5 text-right font-medium">Выполнение</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => (
                <tr key={row.key} className="transition-colors hover:bg-slate-50/70">
                  <td className="max-w-[320px] truncate px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {row.akb != null ? fmtCount(row.akb) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {typeof row.plan === "string" && row.plan !== "—" ? fmtMoney(row.plan) : row.plan}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {typeof row.fact === "string" ? fmtMoney(row.fact) : row.fact}
                  </td>
                  <td className="px-3 py-2.5">
                    <MonitoringExecutionBar
                      completion={
                        activeTab === "directions"
                          ? typeof row.execution === "number"
                            ? row.execution
                            : null
                          : (row.execution as number | null)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {useServerPager ? (
          <MonitoringTablePager
            total={total}
            page={safePage}
            pageSize={activeTab === "branches" ? branchPageSize : supervisorPageSize}
            onPageChange={activeTab === "branches" ? onBranchPageChange : onSupervisorPageChange}
            onPageSizeChange={activeTab === "branches" ? onBranchPageSizeChange : onSupervisorPageSizeChange}
          />
        ) : (
          <MonitoringTablePager
            total={total}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={() => {}}
          />
        )}
      </div>
    </section>
  );
}

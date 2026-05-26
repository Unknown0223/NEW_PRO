"use client";

import { MonitoringExecutionBar } from "@/components/dashboard/monitoring/monitoring-execution-bar";
import { MonitoringTablePager } from "@/components/dashboard/monitoring/monitoring-table-pager";
import { fmtCount, fmtMoney } from "@/components/dashboard/monitoring/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type MonitoringPerformanceRow = {
  key: string;
  name: string;
  akb: number | null;
  plan: string | number;
  fact: string | number;
  execution: number | null;
  executionIsShare?: boolean;
};

export function MonitoringPerformanceTable({
  title,
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  serverPaging
}: {
  title: string;
  rows: MonitoringPerformanceRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  serverPaging: boolean;
}) {
  const [search, setSearch] = useState("");
  const [localPage, setLocalPage] = useState(0);
  const localPageSize = 20;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const effectiveTotal = serverPaging ? total : filtered.length;
  const effectivePageSize = serverPaging ? pageSize : localPageSize;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / effectivePageSize));
  const safePage = serverPaging ? Math.min(page, totalPages - 1) : Math.min(localPage, totalPages - 1);

  const visibleRows = serverPaging
    ? filtered
    : filtered.slice(safePage * effectivePageSize, (safePage + 1) * effectivePageSize);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">{title}</h2>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {serverPaging ? (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            defaultValue={20}
            disabled
          >
            <option value={20}>20</option>
          </select>
        )}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLocalPage(0);
            }}
            placeholder="Поиск"
            className="h-10 pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => setSearch("")}>
          <RotateCcw className="h-4 w-4 text-teal-600" />
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Названия</th>
              <th className="px-4 py-3 text-right font-medium">АКБ</th>
              <th className="px-4 py-3 text-right font-medium">План</th>
              <th className="px-4 py-3 text-right font-medium">Факт</th>
              <th className="px-4 py-3 text-right font-medium">Выполнение плана</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 hover:bg-teal-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {row.akb != null ? fmtCount(row.akb) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                  {typeof row.plan === "string" && row.plan !== "—" ? fmtMoney(row.plan) : row.plan}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {typeof row.fact === "string" ? fmtMoney(row.fact) : row.fact}
                </td>
                <td className="px-4 py-3">
                  <MonitoringExecutionBar completion={row.execution} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MonitoringTablePager
        total={effectiveTotal}
        page={safePage}
        pageSize={effectivePageSize}
        onPageChange={serverPaging ? onPageChange : setLocalPage}
        onPageSizeChange={serverPaging ? onPageSizeChange : () => {}}
      />
    </section>
  );
}

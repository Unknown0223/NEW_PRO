"use client";

import { SalesSectionPanel } from "@/components/dashboard/sales/sales-section-panel";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Filter, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

export type SalesTableColumn<T> = {
  id: string;
  header: string;
  footer?: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  searchText?: (row: T) => string;
};

function downloadCsv<T extends object>(fileName: string, rows: T[]) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0] as object);
  const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => String((r as Record<string, unknown>)[k] ?? "")).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function SalesDataTable<T extends object>({
  title,
  data,
  columns,
  initialPageSize = 10,
  className,
  compact = false,
  onExportXlsx,
  rowKey
}: {
  title: string;
  data: T[];
  columns: SalesTableColumn<T>[];
  initialPageSize?: number;
  className?: string;
  compact?: boolean;
  onExportXlsx?: () => void;
  rowKey: (row: T, index: number) => string;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      columns.some((col) => (col.searchText?.(row) ?? "").toLowerCase().includes(q))
    );
  }, [data, columns, globalFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const start = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(filtered.length, (safePage + 1) * pageSize);
  const hasFooter = columns.some((c) => c.footer != null);

  return (
    <SalesSectionPanel title={title} className={className}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Sort"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Filter"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => (onExportXlsx ? onExportXlsx() : downloadCsv(`${title}.csv`, data))}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Excel
          </button>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPageIndex(0);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
          >
            {[5, 10, 20, 44].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={globalFilter}
              onChange={(event) => {
                setGlobalFilter(event.target.value);
                setPageIndex(0);
              }}
              placeholder="Поиск"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
            />
          </label>
          <button
            type="button"
            onClick={() => setGlobalFilter("")}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-teal-700 transition hover:bg-teal-50"
            aria-label="Refresh search"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className={cn("min-w-full divide-y divide-slate-200 text-sm", compact && "text-xs")}>
            <thead className="bg-slate-50">
              <tr>
                {columns.map((col) => (
                  <th key={col.id} className="px-3 py-3 text-left font-semibold text-slate-500">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {pageRows.map((row, idx) => (
                <tr key={rowKey(row, idx)} className="transition hover:bg-teal-50/55">
                  {columns.map((col) => (
                    <td key={col.id} className="px-3 py-3 text-slate-700">
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasFooter ? (
              <tfoot className="bg-slate-50 font-bold text-slate-800">
                <tr>
                  {columns.map((col) => (
                    <td key={col.id} className="px-3 py-3">
                      {col.footer ?? null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-3 text-sm text-slate-500">
          <span>
            Показано <strong className="text-teal-700">{start} - {end}</strong> / {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={safePage <= 0}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-xl bg-teal-600 px-3 py-2 font-bold text-white">{safePage + 1}</span>
            <span>из {pageCount}</span>
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </SalesSectionPanel>
  );
}

"use client";

import {
  compareCellValues,
  matchesColumnFilter,
  rawColumnValue,
  SalesTableSettingsPanel,
  SortIndicator,
  type SalesTableSort
} from "@/components/dashboard/sales/sales-data-table-tools";
import { SalesSectionPanel } from "@/components/dashboard/sales/sales-section-panel";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Filter, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export type SalesTableColumn<T> = {
  id: string;
  header: string;
  footer?: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  searchText?: (row: T) => string;
  sortValue?: (row: T) => string | number | null;
};

const TOOL_BTN =
  "grid h-10 w-10 place-items-center rounded-xl border border-border text-slate-600 transition hover:bg-muted";
const TOOL_BTN_ACTIVE = "border-teal-300 bg-teal-50 text-teal-700";

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
  rowKey,
  action
}: {
  title: string;
  action?: React.ReactNode;
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
  const [sort, setSort] = useState<SalesTableSort>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenIds.has(c.id)), [columns, hiddenIds]);
  const activeColumnFilters = Object.values(columnFilters).some((v) => v.trim() !== "");

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    let rows = q
      ? data.filter((row) => columns.some((col) => (col.searchText?.(row) ?? "").toLowerCase().includes(q)))
      : data;
    const colFilters = columns.filter((c) => (columnFilters[c.id] ?? "").trim() !== "");
    if (colFilters.length > 0) {
      rows = rows.filter((row) =>
        colFilters.every((c) => matchesColumnFilter(rawColumnValue(row, c), columnFilters[c.id]!))
      );
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col) {
        const sign = sort.dir === "asc" ? 1 : -1;
        rows = [...rows].sort((a, b) => sign * compareCellValues(rawColumnValue(a, col), rawColumnValue(b, col)));
      }
    }
    return rows;
  }, [data, columns, globalFilter, columnFilters, sort]);

  const toggleHeaderSort = (id: string) => {
    setSort((cur) => (cur?.id !== id ? { id, dir: "desc" } : cur.dir === "desc" ? { id, dir: "asc" } : null));
    setPageIndex(0);
  };
  const toggleColumn = (id: string) =>
    setHiddenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const resetAll = () => {
    setGlobalFilter("");
    setColumnFilters({});
    setSort(null);
    setPageIndex(0);
  };
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const start = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(filtered.length, (safePage + 1) * pageSize);
  const hasFooter = visibleColumns.some((c) => c.footer != null);

  return (
    <SalesSectionPanel title={title} className={className} action={action}>
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={cn(TOOL_BTN, (settingsOpen || sort || hiddenIds.size > 0) && TOOL_BTN_ACTIVE)}
              aria-label="Сортировка и столбцы"
              aria-expanded={settingsOpen}
              title="Сортировка и столбцы"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            {settingsOpen ? (
              <SalesTableSettingsPanel
                columns={columns}
                hiddenIds={hiddenIds}
                sort={sort}
                onToggleColumn={toggleColumn}
                onSortChange={(next) => {
                  setSort(next);
                  setPageIndex(0);
                }}
                onReset={() => {
                  setSort(null);
                  setHiddenIds(new Set());
                }}
                onClose={closeSettings}
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(TOOL_BTN, (filtersOpen || activeColumnFilters) && TOOL_BTN_ACTIVE)}
            aria-label="Фильтр по столбцам"
            aria-pressed={filtersOpen}
            title="Фильтр по столбцам"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => (onExportXlsx ? onExportXlsx() : downloadCsv(`${title}.csv`, data))}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-slate-700 transition hover:bg-muted"
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
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-slate-700 outline-none"
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
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
            />
          </label>
          <button
            type="button"
            onClick={resetAll}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border text-teal-700 transition hover:bg-teal-50"
            aria-label="Сбросить поиск, фильтры и сортировку"
            title="Сбросить поиск, фильтры и сортировку"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className={cn("min-w-full divide-y divide-border text-sm", compact && "text-xs")}>
            <thead className="bg-muted">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.id}
                    className="px-3 py-3 text-left font-semibold text-slate-500"
                    aria-sort={sort?.id === col.id ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => toggleHeaderSort(col.id)}
                      className="inline-flex items-center whitespace-nowrap hover:text-slate-800"
                      title="Сортировать"
                    >
                      {col.header}
                      <SortIndicator active={sort?.id === col.id} dir={sort?.dir ?? "desc"} />
                    </button>
                  </th>
                ))}
              </tr>
              {filtersOpen ? (
                <tr className="bg-card">
                  {visibleColumns.map((col) => (
                    <th key={col.id} className="px-2 py-2">
                      <input
                        value={columnFilters[col.id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setColumnFilters((cur) => ({ ...cur, [col.id]: v }));
                          setPageIndex(0);
                        }}
                        placeholder={
                          typeof (data[0] ? rawColumnValue(data[0], col) : null) === "number" ? "> 1000, 10-50" : "Содержит…"
                        }
                        aria-label={`Фильтр: ${col.header}`}
                        className="h-8 w-full min-w-[80px] rounded-lg border border-border bg-card px-2 text-xs font-normal text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                      />
                    </th>
                  ))}
                </tr>
              ) : null}
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-3 py-8 text-center text-slate-400">
                    Нет данных
                  </td>
                </tr>
              ) : null}
              {pageRows.map((row, idx) => (
                <tr key={rowKey(row, idx)} className="transition hover:bg-teal-50/55">
                  {visibleColumns.map((col) => (
                    <td key={col.id} className="px-3 py-3 text-slate-700">
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasFooter ? (
              <tfoot className="bg-muted font-bold text-slate-800">
                <tr>
                  {visibleColumns.map((col) => (
                    <td key={col.id} className="px-3 py-3">
                      {col.footer ?? null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3 text-sm text-slate-500">
          <span>
            Показано <strong className="text-teal-700">{start} - {end}</strong> / {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={safePage <= 0}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-xl bg-teal-600 px-3 py-2 font-bold text-white">{safePage + 1}</span>
            <span>из {pageCount}</span>
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-slate-600 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </SalesSectionPanel>
  );
}

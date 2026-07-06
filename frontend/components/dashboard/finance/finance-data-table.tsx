"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceCount } from "@/components/dashboard/finance/format";
import type { FinanceTableColumn } from "@/components/dashboard/finance/table-columns";
import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type { FinanceTableColumn };
export { categoryTableColumns, territoryTableColumns } from "@/components/dashboard/finance/table-columns";

type SortDir = "asc" | "desc";

function sortRows<T>(
  rows: T[],
  columns: FinanceTableColumn<T>[],
  key: string,
  direction: SortDir
): T[] {
  const column = columns.find((c) => c.id === key) ?? columns[0];
  if (!column) return rows;
  return [...rows].sort((a, b) => {
    const first = column.sortValue ? column.sortValue(a) : String(column.value(a));
    const second = column.sortValue ? column.sortValue(b) : String(column.value(b));
    const mul = direction === "asc" ? 1 : -1;
    if (typeof first === "number" && typeof second === "number") return (first - second) * mul;
    return String(first).localeCompare(String(second), "ru") * mul;
  });
}

function escapeCsv(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function exportCsv<T>(fileName: string, columns: FinanceTableColumn<T>[], rows: T[]) {
  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns.map((c) => escapeCsv(c.csvValue ? c.csvValue(row) : String(c.value(row)))).join(",")
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDir }) {
  return (
    <span className={`text-[10px] ${active ? "text-teal-600" : "text-slate-300"}`}>
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

function FinanceTablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount])).filter(
    (value) => value >= 1 && value <= pageCount
  );

  return (
    <div className="mt-3 flex flex-col gap-3 text-sm font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Показано {fmtFinanceCount(start)} - {fmtFinanceCount(end)} / {fmtFinanceCount(total)}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-slate-500 hover:bg-muted"
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          ‹
        </button>
        {pages.map((item, index) => {
          const previous = pages[index - 1];
          return (
            <span key={item} className="flex items-center gap-2">
              {previous && item - previous > 1 ? <span className="px-1 text-slate-400">...</span> : null}
              <button
                type="button"
                className={`h-9 min-w-9 rounded-lg px-3 font-bold transition ${
                  item === page
                    ? "bg-teal-600 text-white"
                    : "border border-border text-slate-700 hover:border-teal-300"
                }`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-slate-500 hover:bg-muted"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export function FinanceDataTable<T>({
  title,
  subtitle,
  data,
  columns,
  totals,
  searchKeys,
  exportFileName,
  minWidth
}: {
  title: string;
  subtitle?: string;
  data: T[];
  columns: FinanceTableColumn<T>[];
  totals?: Record<string, string>;
  searchKeys: Array<(row: T) => string>;
  exportFileName: string;
  minWidth: number;
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: SortDir }>({
    key: columns[0]?.id ?? "",
    direction: "asc"
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data;
    return data.filter((row) => searchKeys.some((acc) => acc(row).toLowerCase().includes(normalized)));
  }, [data, query, searchKeys]);

  const sorted = useMemo(
    () => sortRows(filtered, columns, sort.key, sort.direction),
    [filtered, columns, sort]
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, data]);

  const handleSort = (key: string) => {
    setSort((cur) => ({
      key,
      direction: cur.key === key && cur.direction === "asc" ? "desc" : "asc"
    }));
  };

  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader title={title} subtitle={subtitle} />
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
            onClick={() => exportCsv(exportFileName, columns, sorted)}
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Excel
          </button>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <label className="relative w-full lg:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск"
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm font-medium outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          />
        </label>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth }}>
            <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={`border-b border-border px-3 py-3 text-right font-bold ${col.className ?? ""}`}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                      <SortIcon active={sort.key === col.id} direction={sort.direction} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border/80 text-slate-700 transition hover:bg-teal-50/45"
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={`px-3 py-3 text-right tabular-nums ${col.className ?? ""}`}
                    >
                      {col.value(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totals ? (
              <tfoot className="sticky bottom-0 bg-muted font-black text-slate-700">
                <tr>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={`border-t border-border px-3 py-3 text-right tabular-nums ${col.className ?? ""}`}
                    >
                      {totals[col.id] ?? ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
      <FinanceTablePagination
        page={safePage}
        pageCount={pageCount}
        pageSize={pageSize}
        total={sorted.length}
        onPageChange={setPage}
      />
    </section>
  );
}

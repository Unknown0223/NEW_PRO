"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import type { FinanceTableColumn } from "@/components/dashboard/finance/table-columns";
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
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader title={title} subtitle={subtitle} />
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => exportCsv(exportFileName, columns, sorted)}
          >
            Excel
          </button>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-teal-500 lg:w-[320px]"
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth }}>
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={`border-b border-slate-200 px-3 py-3 text-right font-bold ${col.className ?? ""}`}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                      <span className="text-[10px] text-teal-600">
                        {sort.key === col.id ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-200/80 text-slate-700 transition hover:bg-teal-50/45"
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
              <tfoot className="sticky bottom-0 bg-slate-50 font-black text-slate-700">
                <tr>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={`border-t border-slate-200 px-3 py-3 text-right tabular-nums ${col.className ?? ""}`}
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {sorted.length === 0
            ? "0 записей"
            : `${(safePage - 1) * pageSize + 1}–${Math.min(sorted.length, safePage * pageSize)} из ${sorted.length}`}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className="h-8 rounded-md border px-2 disabled:opacity-50"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Назад
          </button>
          <span className="flex h-8 items-center px-2 tabular-nums">
            {safePage} / {pageCount}
          </span>
          <button
            type="button"
            className="h-8 rounded-md border px-2 disabled:opacity-50"
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Вперёд
          </button>
        </div>
      </div>
    </section>
  );
}

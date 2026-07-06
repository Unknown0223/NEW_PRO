"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceCount } from "@/components/dashboard/finance/format";
import {
  CLIENT_LEDGER_COL_DEFS,
  clientLedgerCell,
  clientLedgerCsvValue,
  clientLedgerSortValue
} from "@/components/dashboard/finance/table-columns";
import type { FinanceClientDebtRow } from "@/components/dashboard/finance/types";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { useDashboardVirtualRows } from "@/components/dashboard/dashboard-virtual-tbody";
import { Download, LayoutGrid, Search } from "lucide-react";
import { useMemo, useState } from "react";

type SortDir = "asc" | "desc";

export function FinanceClientLedger(props: {
  rows: FinanceClientDebtRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (size: number) => void;
  columnOrder: string[];
  hiddenColumnIds: Set<string>;
  onSaveColumns: (next: { columnOrder: string[]; hiddenColumnIds: string[] }) => void;
  onResetColumns: () => void;
  columnsSaving?: boolean;
  isFetching?: boolean;
}) {
  const {
    rows,
    total,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    columnOrder,
    hiddenColumnIds,
    onSaveColumns,
    onResetColumns,
    columnsSaving,
    isFetching
  } = props;

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: SortDir }>({
    key: "effective_balance",
    direction: "desc"
  });
  const [columnsOpen, setColumnsOpen] = useState(false);

  const visibleCols = useMemo(() => {
    const hidden = hiddenColumnIds;
    const order = columnOrder.length > 0 ? columnOrder : CLIENT_LEDGER_COL_DEFS.map((c) => c.id);
    return order
      .filter((id) => !hidden.has(id))
      .map((id) => CLIENT_LEDGER_COL_DEFS.find((c) => c.id === id))
      .filter((c): c is ColumnDefItem => Boolean(c));
  }, [columnOrder, hiddenColumnIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        (r.agent_name ?? "").toLowerCase().includes(q) ||
        (r.supervisor_name ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const key = sort.key;
    const dir = sort.direction;
    return [...filtered].sort((a, b) => {
      const first = clientLedgerSortValue(a, key);
      const second = clientLedgerSortValue(b, key);
      const mul = dir === "asc" ? 1 : -1;
      if (typeof first === "number" && typeof second === "number") return (first - second) * mul;
      return String(first).localeCompare(String(second), "ru") * mul;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const virtual = useDashboardVirtualRows(sorted.length, 64);

  const exportCsv = () => {
    const header = visibleCols.map((c) => `"${c.label}"`).join(",");
    const body = sorted
      .map((row) =>
        visibleCols.map((c) => `"${String(clientLedgerCsvValue(row, c.id)).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customer-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-slate-200/70"
      data-dashboard-section="finance-client-ledger"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <FinanceSectionHeader
          title="Список клиенты"
          subtitle="Реестр задолженности с серверной пагинацией и поиском"
        />
        {isFetching ? <span className="text-xs font-medium text-teal-700">Обновление…</span> : null}
      </div>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
            onClick={exportCsv}
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Excel
          </button>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500"
          >
            {[10, 20, 30, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold text-slate-700 hover:border-teal-300"
            onClick={() => setColumnsOpen(true)}
          >
            <LayoutGrid className="h-4 w-4" />
            Колонки
          </button>
        </div>
        <label className="relative w-full lg:w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск клиента"
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm font-medium outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          />
        </label>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div
          ref={virtual.enabled ? virtual.scrollRef : undefined}
          className="overflow-auto"
          style={virtual.enabled ? { maxHeight: 520 } : { maxHeight: 560 }}
        >
          <table className="w-full min-w-[1190px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                {visibleCols.map((col) => (
                  <th
                    key={col.id}
                    className={`border-b border-border px-3 py-3 text-right ${col.id === "client" ? "text-left" : ""}`}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() =>
                        setSort((s) => ({
                          key: col.id,
                          direction: s.key === col.id && s.direction === "asc" ? "desc" : "asc"
                        }))
                      }
                    >
                      {col.label}
                      <span className={`text-[10px] ${sort.key === col.id ? "text-teal-600" : "text-slate-300"}`}>
                        {sort.key === col.id ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {virtual.enabled && virtual.padTop > 0 ? (
                <tr aria-hidden style={{ height: virtual.padTop }}>
                  <td colSpan={visibleCols.length} className="border-none p-0" />
                </tr>
              ) : null}
              {(virtual.enabled
                ? virtual.virtualItems.map((v) => v.index)
                : sorted.map((_, i) => i)
              ).map((idx) => {
                const row = sorted[idx]!;
                return (
                  <tr
                    key={`${row.client_id}-${idx}`}
                    className="border-b border-border/80 text-slate-700 transition hover:bg-teal-50/45"
                  >
                    {visibleCols.map((col) => (
                      <td
                        key={col.id}
                        className={`px-3 py-3 tabular-nums ${col.id === "client" ? "text-left font-semibold" : "text-right"}`}
                      >
                        {clientLedgerCell(row, col.id)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {virtual.enabled && virtual.padBottom > 0 ? (
                <tr aria-hidden style={{ height: virtual.padBottom }}>
                  <td colSpan={visibleCols.length} className="border-none p-0" />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 text-sm font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Показано {fmtFinanceCount(sorted.length)} на странице · страница {safePage} / {totalPages}
        </span>
        <span>Всего: {fmtFinanceCount(total)} клиентов</span>
      </div>
      <div className="mt-2 flex gap-1">
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-slate-500 hover:bg-muted disabled:opacity-50"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          ‹
        </button>
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-slate-500 hover:bg-muted disabled:opacity-50"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          ›
        </button>
      </div>
      <TableColumnSettingsDialog
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        columns={CLIENT_LEDGER_COL_DEFS}
        columnOrder={columnOrder}
        hiddenColumnIds={hiddenColumnIds}
        onSave={(next) => onSaveColumns(next)}
        onReset={onResetColumns}
        saving={columnsSaving}
      />
    </section>
  );
}

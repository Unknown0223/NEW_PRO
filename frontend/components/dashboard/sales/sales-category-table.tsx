"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
import { salesExportButtonClass, SalesSectionHeader } from "@/components/dashboard/sales/sales-section-header";
import { SalesTablePager } from "@/components/dashboard/sales/sales-table-pager";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { cn } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";
import { useState } from "react";

export const SALES_CAT_PERF_TABLE_ID = "dashboard-sales/category-performance";
export const SALES_CAT_PERF_COL_DEFS: ColumnDefItem[] = [
  { id: "category", label: "Категория" },
  { id: "sales_sum", label: "Сумма продаж" },
  { id: "sold_qty", label: "Кол-во" },
  { id: "volume", label: "Объем" },
  { id: "akb", label: "АКБ" },
  { id: "share_pct", label: "Доля" }
];
const DEFAULT_ORDER = SALES_CAT_PERF_COL_DEFS.map((c) => c.id);

type Row = SalesDashboardSnapshot["category_performance_table"][number];

export function SalesCategoryTable({
  data,
  tablePrefs,
  onExport
}: {
  data: SalesDashboardSnapshot;
  tablePrefs: {
    visibleColumnOrder: string[];
    columnOrder: string[];
    hiddenColumnIds: Set<string>;
    prefsLoading: boolean;
    saveColumnLayout: (next: { columnOrder: string[]; hiddenColumnIds: string[] }) => void;
    resetColumnLayout: () => void;
  };
  onExport: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const visibleCols = tablePrefs.visibleColumnOrder;
  const labelById = Object.fromEntries(SALES_CAT_PERF_COL_DEFS.map((c) => [c.id, c.label]));
  const pageRows = data.category_performance_table.slice((page - 1) * pageSize, page * pageSize);
  const rightCols = new Set(["sales_sum", "sold_qty", "volume", "akb", "share_pct"]);

  const renderCell = (id: string, r: Row) => {
    if (id === "category") return <td key={id} className="px-2 py-1.5">{r.category}</td>;
    if (id === "sales_sum")
      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sales_sum)}</td>;
    if (id === "sold_qty")
      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.sold_qty)}</td>;
    if (id === "volume")
      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.volume)}</td>;
    if (id === "akb") return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.akb)}</td>;
    if (id === "share_pct")
      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{r.share_pct.toFixed(1)}%</td>;
    return <td key={id} className="px-2 py-1.5">—</td>;
  };

  return (
    <>
      <TableColumnSettingsDialog
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        title="Столбцы таблицы"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={[...SALES_CAT_PERF_COL_DEFS]}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.prefsLoading}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />
      <section className="flex min-h-0 min-w-0 flex-col rounded-2xl bg-card shadow-sm ring-1 ring-slate-200/70">
        <SalesSectionHeader
          title="По категориям (таблица эффективности)"
          exportAction={
            <button type="button" className={salesExportButtonClass} onClick={onExport}>
              Excel
            </button>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span>Строк на странице</span>
            <select
              className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number.parseInt(e.target.value, 10) || 10);
                setPage(1);
              }}
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-lg border border-border px-2 text-xs hover:bg-muted"
            onClick={() => setColumnsOpen(true)}
          >
            <LayoutGrid className="mr-1.5 size-4" />
            Столбцы
          </button>
        </div>
        <div className="overflow-x-auto px-4">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            {visibleCols.length === 0 ? (
              <tbody>
                <tr>
                  <td className="px-3 py-10 text-center text-slate-500">Нет видимых столбцов.</td>
                </tr>
              </tbody>
            ) : (
              <>
                <thead>
                  <tr className="border-b border-border text-xs text-slate-500">
                    {visibleCols.map((id) => (
                      <th
                        key={id}
                        className={cn("px-2 py-2", rightCols.has(id) ? "text-right" : "text-left")}
                      >
                        {labelById[id] ?? id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.category} className="border-b border-slate-50">
                      {visibleCols.map((id) => renderCell(id, r))}
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
        <SalesTablePager
          total={data.category_performance_table.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>
    </>
  );
}

export { DEFAULT_ORDER as SALES_CAT_PERF_DEFAULT_ORDER };

"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
import { salesExportButtonClass, SalesSectionHeader } from "@/components/dashboard/sales/sales-section-header";
import { SalesTablePager } from "@/components/dashboard/sales/sales-table-pager";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { TableColumnSettingsDialog, type ColumnDefItem } from "@/components/data-table/table-column-settings-dialog";
import { cn } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";
import { useState } from "react";

export const SALES_AGENT_TABLE_ID = "dashboard-sales/agent-analytics";
export const SALES_AGENT_COL_DEFS: ColumnDefItem[] = [
  { id: "agent_name", label: "Агент" },
  { id: "agent_code", label: "Код" },
  { id: "sales_sum", label: "Сумма продаж" },
  { id: "akb", label: "АКБ" },
  { id: "okb", label: "ОКБ" },
  { id: "coverage_pct", label: "Процент ОКБ" }
];
export const SALES_AGENT_DEFAULT_ORDER = SALES_AGENT_COL_DEFS.map((c) => c.id);

type Row = SalesDashboardSnapshot["agent_analytics"][number];

export function SalesAgentTable({
  data,
  agentTotal,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  tablePrefs,
  onExport
}: {
  data: SalesDashboardSnapshot;
  agentTotal: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (size: number) => void;
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
  const [columnsOpen, setColumnsOpen] = useState(false);
  const visibleCols = tablePrefs.visibleColumnOrder;
  const labelById = Object.fromEntries(SALES_AGENT_COL_DEFS.map((c) => [c.id, c.label]));
  const rightCols = new Set(["sales_sum", "akb", "okb", "coverage_pct"]);

  const renderCell = (id: string, r: Row) => {
    if (id === "agent_name") return <td key={id} className="px-2 py-1.5">{r.agent_name}</td>;
    if (id === "agent_code") return <td key={id} className="px-2 py-1.5">{r.agent_code ?? "—"}</td>;
    if (id === "sales_sum")
      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sales_sum)}</td>;
    if (id === "akb") return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.akb)}</td>;
    if (id === "okb") return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtCount(r.okb)}</td>;
    if (id === "coverage_pct")
      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{r.coverage_pct.toFixed(1)}%</td>;
    return <td key={id} className="px-2 py-1.5">—</td>;
  };

  return (
    <>
      <TableColumnSettingsDialog
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        title="Столбцы таблицы"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={[...SALES_AGENT_COL_DEFS]}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.prefsLoading}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />
      <section className="rounded-2xl bg-card shadow-sm ring-1 ring-slate-200/70">
        <SalesSectionHeader
          title="Аналитика по агентам"
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
              onChange={(e) => onPageSizeChange(Number.parseInt(e.target.value, 10) || 10)}
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
          <table className="w-full min-w-[980px] border-collapse text-sm">
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
                  {data.agent_analytics.map((r) => (
                    <tr key={r.agent_id} className="border-b border-slate-50">
                      {visibleCols.map((id) => renderCell(id, r))}
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
        <SalesTablePager total={agentTotal} page={page} pageSize={pageSize} onPageChange={onPageChange} />
      </section>
    </>
  );
}

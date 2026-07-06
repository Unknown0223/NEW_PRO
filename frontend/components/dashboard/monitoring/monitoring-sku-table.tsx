"use client";

import { MonitoringTablePager } from "@/components/dashboard/monitoring/monitoring-table-pager";
import { MON_SKU_COLS } from "@/components/dashboard/monitoring/table-constants";
import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { fmtMoney, fmtQty, skuNeedsAttention } from "@/components/dashboard/monitoring/utils";
import { SalesSectionPanel } from "@/components/dashboard/sales/sales-section-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";

const theadSticky = "sticky top-0 z-20 border-b border-border bg-muted/95 backdrop-blur-sm shadow-sm";
const tableWrap = "relative overflow-auto rounded-md border border-border";

export function MonitoringSkuTable({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  visibleColumnOrder,
  onOpenColumns
}: {
  rows: MonitoringSnapshot["sku_matrix"];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  visibleColumnOrder: string[];
  onOpenColumns: () => void;
}) {
  return (
    <SalesSectionPanel
      className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-slate-200/70"
      title="Продажи по SKU (статусы)"
      subtitle="Кол-во и доли отмен/возвратов; маркер при высоких %"
      action={
        MON_SKU_COLS.length > 5 ? (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={onOpenColumns}>
            <LayoutGrid className="h-4 w-4" />
            Столбцы
          </Button>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Нет продаж по SKU за период</p>
      ) : (
      <div className={cn(tableWrap, "max-h-[min(600px,70vh)]")}>
        <table className="w-full min-w-[1280px] table-fixed border-collapse text-xs sm:text-sm">
          <thead className={theadSticky}>
            <tr>
              {visibleColumnOrder.map((id) => {
                const col = MON_SKU_COLS.find((c) => c.id === id);
                return col ? (
                  <th key={id} className="px-2 py-2 text-left text-xs font-medium">
                    {col.label}
                  </th>
                ) : null;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.sku + r.name}
                className={cn(
                  "border-b border-border/50 hover:bg-muted/20",
                  skuNeedsAttention(r) && "border-l-[3px] border-l-amber-500 bg-amber-500/[0.06]"
                )}
              >
                {visibleColumnOrder.map((id) => {
                  switch (id) {
                    case "name":
                      return <td key={id} className="truncate px-2 py-1.5">{r.name}</td>;
                    case "sku":
                      return <td key={id} className="truncate px-2 py-1.5 font-mono text-[11px]">{r.sku}</td>;
                    case "total_qty":
                      return <td key={id} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtQty(r.total_qty)}</td>;
                    case "total_sum":
                      return <td key={id} className="px-2 py-1.5 text-right font-medium tabular-nums">{fmtMoney(r.total_sum)}</td>;
                    case "return_pct":
                      return (
                        <td key={id} className={cn("px-2 py-1.5 text-right tabular-nums", (r.return_pct ?? 0) >= 5 && "font-medium text-amber-700")}>
                          {r.return_pct != null ? `${r.return_pct.toFixed(1)}%` : "—"}
                        </td>
                      );
                    case "cancel_pct":
                      return (
                        <td key={id} className={cn("px-2 py-1.5 text-right tabular-nums", (r.cancel_pct ?? 0) >= 12 && "font-medium text-amber-700")}>
                          {r.cancel_pct != null ? `${r.cancel_pct.toFixed(1)}%` : "—"}
                        </td>
                      );
                    case "sum_new":
                      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sum_new)}</td>;
                    case "sum_cancelled":
                      return <td key={id} className="px-2 py-1.5 text-right tabular-nums text-red-600/90">{fmtMoney(r.sum_cancelled)}</td>;
                    case "sum_confirmed":
                      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sum_confirmed)}</td>;
                    case "sum_shipped":
                      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sum_shipped)}</td>;
                    case "sum_delivered":
                      return <td key={id} className="px-2 py-1.5 text-right tabular-nums text-emerald-700/90">{fmtMoney(r.sum_delivered)}</td>;
                    case "sum_returned":
                      return <td key={id} className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sum_returned)}</td>;
                    default:
                      return null;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {rows.length > 0 ? (
        <MonitoringTablePager total={total} page={page} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
      ) : null}
    </SalesSectionPanel>
  );
}

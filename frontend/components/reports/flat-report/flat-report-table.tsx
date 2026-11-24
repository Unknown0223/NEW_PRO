"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlatReportColumn, FlatReportConfig } from "./types";
import { formatCell, readReportTotal, resolveCellValue } from "./flat-report-helpers";

type Props = {
  config: FlatReportConfig;
  columns: FlatReportColumn[];
  rows: Array<Record<string, unknown>>;
  applied: Record<string, string | number | string[]>;
  reportData: ({ totals?: Record<string, unknown>; total: number; limit: number } & Record<string, unknown>) | undefined;
  loading: boolean;
  fetching: boolean;
  totalPages: number;
  onPage: (page: number) => void;
};

/** Jadval + pager — loyiha `app-table-thead` / card ichida. */
export function FlatReportTable({
  config,
  columns,
  rows,
  applied,
  reportData,
  loading,
  fetching,
  totalPages,
  onPage
}: Props) {
  const colCount = columns.length;
  const footerLead = config.footerLeadColSpan ?? Math.max(1, colCount - config.totalsKeys.length);
  const page = Number(applied.page) || 1;

  return (
    <>
      <div className="overflow-auto">
        <table className="w-full min-w-[1050px] text-xs">
          <thead className="app-table-thead">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("px-2 py-2", col.align === "right" ? "text-right" : "text-left")}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading || rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-muted-foreground" colSpan={Math.max(1, colCount)}>
                  {loading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const keyVal = r[config.rowKey];
                const rowReactKey = keyVal != null ? String(keyVal) : String(idx);
                const tone = config.rowClassName?.(r, applied);
                return (
                  <tr key={rowReactKey} className={cn("border-t border-border/60", tone)}>
                    {columns.map((col) => {
                      const cellVal = resolveCellValue(col, r);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "whitespace-nowrap px-2 py-1.5",
                            col.align === "right" && "text-right",
                            col.cellClassName
                          )}
                        >
                          {config.formatters?.[col.key]
                            ? config.formatters[col.key](cellVal, r)
                            : formatCell(cellVal, col.format)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
          {reportData &&
          rows.length > 0 &&
          config.totalsKeys.length > 0 &&
          config.showTableFooter !== false ? (
            <tfoot className="border-t bg-muted/30 font-medium">
              <tr>
                <td className="px-2 py-2" colSpan={footerLead}>
                  Итого
                </td>
                {columns.slice(footerLead).map((col) => {
                  if (!config.totalsKeys.includes(col.key)) {
                    return <td key={col.key} className="px-2 py-2" />;
                  }
                  const raw = readReportTotal(reportData, col.key);
                  return (
                    <td
                      key={col.key}
                      className={cn("px-2 py-2", col.align === "right" && "text-right")}
                    >
                      {formatCell(raw, col.format ?? "money")}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex items-center gap-2 border-t px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || fetching}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          Назад
        </Button>
        <span className="text-xs text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || fetching}
          onClick={() => onPage(page + 1)}
        >
          Далее
        </Button>
      </div>
    </>
  );
}

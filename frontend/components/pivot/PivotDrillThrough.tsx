"use client";

import { useMemo } from "react";
import type { PivotCellDrillContext, PivotField } from "@salec/pivot-engine";
import { exportRawRecordsToExcel, getPivotStrings } from "@salec/pivot-engine";
import { FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Drill-through da birinchi ko‘rsatiladigan ustunlar (savdo qatori). */
const DRILL_PREFERRED_IDS = [
  "client_name",
  "agent_name",
  "category_name",
  "product_name",
  "product_sku",
  "brand_name",
  "is_bonus",
  "bonus_qty",
  "amount",
  "qty",
  "volume",
  "order_number",
  "order_status"
] as const;

/** Joy egallab, mahsulot/qiymatni siqib chiqaradigan shovqinli o‘lchovlar. */
const DRILL_EXCLUDED_IDS = new Set([
  "client_category",
  "client_zone",
  "client_region",
  "client_city",
  "agent_branch",
  "agent_code",
  "work_slot_code"
]);

const DRILL_MAX_COLUMNS = 14;

type Props = {
  open: boolean;
  records: Record<string, unknown>[];
  fields: PivotField[];
  cellContext?: PivotCellDrillContext;
  /** Optional explicit column order (field ids). */
  columnIds?: string[];
  onClose: () => void;
  className?: string;
};

function resolveDrillThroughColumns(
  records: Record<string, unknown>[],
  fields: PivotField[],
  valueFieldId?: string,
  columnIds?: string[]
): string[] {
  if (columnIds?.length) {
    return columnIds.filter((id) => records.some((r) => id in r) || fields.some((f) => f.id === id));
  }
  const present = new Set<string>();
  for (const row of records.slice(0, 80)) {
    for (const key of Object.keys(row)) {
      if (!DRILL_EXCLUDED_IDS.has(key)) present.add(key);
    }
  }

  const ordered: string[] = [];
  const push = (id: string) => {
    if (!present.has(id) || ordered.includes(id)) return;
    ordered.push(id);
  };

  if (valueFieldId) push(valueFieldId);
  for (const id of DRILL_PREFERRED_IDS) push(id);
  for (const f of fields) {
    if (ordered.length >= DRILL_MAX_COLUMNS) break;
    push(f.id);
  }
  for (const id of present) {
    if (ordered.length >= DRILL_MAX_COLUMNS) break;
    push(id);
  }

  return ordered.slice(0, DRILL_MAX_COLUMNS);
}

export function PivotDrillThrough({ open, records, fields, cellContext, columnIds, onClose, className }: Props) {
  const t = getPivotStrings().drillThrough;
  const displayFields = useMemo(
    () => resolveDrillThroughColumns(records, fields, cellContext?.valueFieldId, columnIds),
    [records, fields, cellContext?.valueFieldId, columnIds]
  );

  const exportColumns = useMemo(
    () =>
      displayFields.map((id) => ({
        id,
        label: fields.find((f) => f.id === id)?.label ?? id
      })),
    [displayFields, fields]
  );

  const handleExport = () => {
    if (!records.length) return;
    exportRawRecordsToExcel(records, exportColumns, {
      filename: `drill-through-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: t.sheetName
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div
        className={cn(
          "flex max-h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg",
          className
        )}
        role="dialog"
        aria-labelledby="drill-through-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 id="drill-through-title" className="text-sm font-semibold">
              {t.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t.rowCount(records.length.toLocaleString("ru-RU"))}
              {cellContext?.valueFieldId && ` · ${cellContext.valueFieldId}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {records.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-auto p-2">
          {records.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t.noRows}</p>
          ) : (
            <table className="w-full min-w-max border-collapse text-xs">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  {displayFields.map((id) => (
                    <th key={id} className="border-b px-2 py-1.5 text-left font-semibold">
                      {fields.find((f) => f.id === id)?.label ?? id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 500).map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    {displayFields.map((id) => (
                      <td key={id} className="border-b px-2 py-1 tabular-nums">
                        {formatCell(row[id])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {records.length > 500 && (
            <p className="p-2 text-[10px] text-muted-foreground">
              {t.showing(500, records.length)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return value.toLocaleString("ru-RU");
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

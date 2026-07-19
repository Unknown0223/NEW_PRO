import type { PivotData } from "../types/pivot.types.js";
import { pivotDataToAoA, type ExportExcelOptions } from "./ExportExcel.js";

export type ExportCsvOptions = Pick<
  ExportExcelOptions,
  "filename" | "expandedRows" | "useFormattedValues" | "includeSubtotals" | "onProgress"
>;

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Pivot grid → CSV (WDR exportTo('csv') ekvivalenti). */
export async function exportPivotToCsv(
  data: PivotData,
  options: ExportCsvOptions = {}
): Promise<void> {
  const filename = options.filename ?? "pivot-export.csv";
  const totalRows = Math.max(1, data.rows.length);
  options.onProgress?.({ phase: "preparing", processedRows: 0, totalRows });
  const aoa = pivotDataToAoA(data, options);
  const lines = aoa.map((row) => row.map(escapeCsvCell).join(","));
  options.onProgress?.({ phase: "writing", processedRows: totalRows, totalRows });

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  options.onProgress?.({ phase: "done", processedRows: totalRows, totalRows });
}

import type { PivotData } from "../types/pivot.types.js";
import { type ExportExcelOptions } from "./ExportExcel.js";
export type ExportCsvOptions = Pick<ExportExcelOptions, "filename" | "expandedRows" | "useFormattedValues" | "includeSubtotals" | "onProgress">;
/** Pivot grid → CSV (WDR exportTo('csv') ekvivalenti). */
export declare function exportPivotToCsv(data: PivotData, options?: ExportCsvOptions): Promise<void>;
//# sourceMappingURL=ExportCsv.d.ts.map
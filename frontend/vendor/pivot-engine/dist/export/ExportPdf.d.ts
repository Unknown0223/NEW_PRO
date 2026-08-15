import type { PivotData } from "../types/pivot.types.js";
import { type ExportProgress } from "./exportUtils.js";
export type ExportPdfOptions = {
    filename?: string;
    title?: string;
    /** true (default) — formatlangan matn */
    useFormattedValues?: boolean;
    includeSubtotals?: boolean;
    expandedRows?: Set<string>;
    onProgress?: (progress: ExportProgress) => void;
};
export type PivotPdfTable = {
    head: string[][];
    body: (string | number)[][];
};
/** PivotData → jspdf-autotable uchun head/body (smoke test va export uchun). */
export declare function pivotDataToPdfTable(data: PivotData, options?: ExportPdfOptions): PivotPdfTable;
/** @deprecated countPivotExportRows ishlating */
export declare function countPdfExportRows(data: PivotData, expandedRows?: Set<string>): number;
/**
 * Pivot jadvalini PDF sifatida yuklab olish (browser).
 * jspdf + jspdf-autotable dynamic import — bundle hajmini kamaytirish.
 */
export declare function exportPivotToPdf(data: PivotData, options?: ExportPdfOptions): Promise<void>;
//# sourceMappingURL=ExportPdf.d.ts.map
import type { PivotData } from "../types/pivot.types.js";
/** Eksport uchun katta dataset chegarasi (grafik bilan bir xil). */
export declare const EXPORT_LARGE_DATASET_THRESHOLD = 50000;
/** UI bloklanmasligi uchun qatorlar batch hajmi. */
export declare const EXPORT_CHUNK_SIZE = 5000;
export type ExportProgressPhase = "preparing" | "writing" | "done";
export type ExportProgress = {
    phase: ExportProgressPhase;
    processedRows: number;
    totalRows: number;
};
export type ExportWarningOptions = {
    expandedRows?: Set<string>;
    includeSubtotals?: boolean;
    sourceRowCount?: number;
};
export declare function yieldToMain(): Promise<void>;
/** Eksport qilinadigan jadval qatorlari (subtotal va grand total bilan). */
export declare function countPivotExportRows(data: PivotData, options?: ExportWarningOptions): number;
export declare function getExportWarnings(data: PivotData, options?: ExportWarningOptions): string[];
export declare function shouldConfirmLargeExport(data: PivotData, options?: ExportWarningOptions): boolean;
export declare function formatExportProgressLabel(progress: ExportProgress): string;
//# sourceMappingURL=exportUtils.d.ts.map
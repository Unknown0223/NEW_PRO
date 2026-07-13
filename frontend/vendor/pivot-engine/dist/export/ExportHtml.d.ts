import type { PivotData } from "../types/pivot.types.js";
import { type ExportProgress } from "./exportUtils.js";
export type ExportHtmlOptions = {
    filename?: string;
    title?: string;
    useFormattedValues?: boolean;
    includeSubtotals?: boolean;
    expandedRows?: Set<string>;
    onProgress?: (progress: ExportProgress) => void;
};
/** Pivot jadvali uchun chop etishga mos HTML. */
export declare function pivotDataToHtml(data: PivotData, options?: ExportHtmlOptions): string;
/** HTML faylni brauzerda yuklab olish. */
export declare function exportPivotToHtml(data: PivotData, options?: ExportHtmlOptions): Promise<void>;
//# sourceMappingURL=ExportHtml.d.ts.map
import * as XLSX from "xlsx";
import type { PivotData } from "../types/pivot.types.js";
import { type ExportProgress } from "./exportUtils.js";
export type ExportExcelOptions = {
    sheetName?: string;
    filename?: string;
    /** Berilsa — faqat ko'rinadigan qatorlar; aks holda to'liq ierarxiya */
    expandedRows?: Set<string>;
    /** true (default) — formatlangan matn (WDR uslubi); false — xom sonlar */
    useFormattedValues?: boolean;
    includeSubtotals?: boolean;
    onProgress?: (progress: ExportProgress) => void;
};
export declare function buildHeaderMatrix(data: PivotData): {
    matrix: string[][];
    merges: XLSX.Range[];
};
export declare function pivotDataToAoA(data: PivotData, options?: ExportExcelOptions): (string | number)[][];
export declare function buildPivotWorksheet(data: PivotData, options?: ExportExcelOptions): XLSX.WorkSheet;
export declare function buildPivotWorkbook(data: PivotData, options?: ExportExcelOptions): XLSX.WorkBook;
export declare function exportPivotToExcel(data: PivotData, options?: ExportExcelOptions): Promise<void>;
//# sourceMappingURL=ExportExcel.d.ts.map
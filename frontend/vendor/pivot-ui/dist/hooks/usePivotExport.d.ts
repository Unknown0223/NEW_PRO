import { type ExportChartPngOptions, type ExportExcelOptions, type ExportHtmlOptions, type ExportPdfOptions, type ExportCsvOptions, type ExportProgress, type PivotData } from "@salec/pivot-engine";
export type PivotExportFormat = "excel" | "pdf" | "html" | "chartPng" | "csv";
type ExportOptions = ExportExcelOptions & {
    expandedRows?: Set<string>;
};
export declare function usePivotExport(): {
    exportExcel: (data: PivotData | null, options?: ExportOptions) => Promise<boolean>;
    exportPdf: (data: PivotData | null, options?: ExportPdfOptions) => Promise<boolean>;
    exportHtml: (data: PivotData | null, options?: ExportHtmlOptions) => Promise<boolean>;
    exportChartPng: (element: HTMLElement | null, options?: ExportChartPngOptions) => Promise<boolean>;
    exportCsv: (data: PivotData | null, options?: ExportCsvOptions) => Promise<boolean>;
    isExporting: boolean;
    exportFormat: PivotExportFormat | null;
    exportProgress: ExportProgress | null;
    exportProgressLabel: string | null;
};
export {};
//# sourceMappingURL=usePivotExport.d.ts.map
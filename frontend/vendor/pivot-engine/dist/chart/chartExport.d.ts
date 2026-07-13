export type ExportChartPngOptions = {
    filename?: string;
    /** html2canvas scale (default 2 — retina-friendly) */
    scale?: number;
    backgroundColor?: string;
};
export declare function resolveChartExportFilename(filename?: string): string;
/**
 * DOM chart konteynerini PNG sifatida yuklab olish (browser).
 * html2canvas dynamic import — faqat export vaqtida yuklanadi.
 */
export declare function exportChartElementToPng(element: HTMLElement, options?: ExportChartPngOptions): Promise<void>;
//# sourceMappingURL=chartExport.d.ts.map
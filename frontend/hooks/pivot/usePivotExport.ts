import { useCallback, useMemo, useState } from "react";
import {
  exportChartElementToPng,
  exportPivotToExcel,
  exportPivotToHtml,
  exportPivotToPdf,
  formatExportProgressLabel,
  getPivotStrings,
  type ExportChartPngOptions,
  type ExportExcelOptions,
  type ExportHtmlOptions,
  type ExportPdfOptions,
  type ExportProgress,
  type PivotData
} from "@salec/pivot-engine";

export type PivotExportFormat = "excel" | "pdf" | "html" | "chartPng";

type ExportOptions = ExportExcelOptions & {
  expandedRows?: Set<string>;
};

export function usePivotExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<PivotExportFormat | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  const exportProgressLabel = useMemo(() => {
    if (!exportProgress) return null;
    return formatExportProgressLabel(exportProgress);
  }, [exportProgress]);

  const exportingLabel = useMemo(() => {
    if (!isExporting || !exportFormat) return exportProgressLabel;
    const t = getPivotStrings().export;
    if (exportFormat === "excel") return exportProgressLabel ?? t.exportingExcel;
    if (exportFormat === "pdf") return exportProgressLabel ?? t.exportingPdf;
    if (exportFormat === "html") return exportProgressLabel ?? t.exportingHtml;
    return getPivotStrings().chart.exporting;
  }, [exportFormat, exportProgressLabel, isExporting]);

  const runTableExport = useCallback(
    async (
      format: "excel" | "pdf" | "html",
      run: (onProgress: (progress: ExportProgress) => void) => Promise<void>
    ) => {
      setIsExporting(true);
      setExportFormat(format);
      setExportProgress(null);
      try {
        await run((progress) => setExportProgress(progress));
        return true;
      } catch {
        return false;
      } finally {
        setIsExporting(false);
        setExportFormat(null);
        setExportProgress(null);
      }
    },
    []
  );

  const exportExcel = useCallback(
    async (data: PivotData | null, options?: ExportOptions) => {
      if (!data?.rows.length || isExporting) return false;
      return runTableExport("excel", (onProgress) =>
        exportPivotToExcel(data, { ...options, onProgress })
      );
    },
    [isExporting, runTableExport]
  );

  const exportPdf = useCallback(
    async (data: PivotData | null, options?: ExportPdfOptions) => {
      if (!data?.rows.length || isExporting) return false;
      return runTableExport("pdf", (onProgress) =>
        exportPivotToPdf(data, { ...options, onProgress })
      );
    },
    [isExporting, runTableExport]
  );

  const exportHtml = useCallback(
    async (data: PivotData | null, options?: ExportHtmlOptions) => {
      if (!data?.rows.length || isExporting) return false;
      return runTableExport("html", (onProgress) =>
        exportPivotToHtml(data, { ...options, onProgress })
      );
    },
    [isExporting, runTableExport]
  );

  const exportChartPng = useCallback(
    async (element: HTMLElement | null, options?: ExportChartPngOptions) => {
      if (!element || isExporting) return false;
      setIsExporting(true);
      setExportFormat("chartPng");
      setExportProgress(null);
      try {
        await exportChartElementToPng(element, options);
        return true;
      } catch {
        return false;
      } finally {
        setIsExporting(false);
        setExportFormat(null);
        setExportProgress(null);
      }
    },
    [isExporting]
  );

  return {
    exportExcel,
    exportPdf,
    exportHtml,
    exportChartPng,
    isExporting,
    exportFormat,
    exportProgress,
    exportProgressLabel: exportingLabel
  };
}

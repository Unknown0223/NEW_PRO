import { ChevronsDownUp, ChevronsUpDown, FileCode, FileImage, FileSpreadsheet, FileText, Loader2, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { getPivotStrings } from "@salec/pivot-engine";
import type { PivotExportFormat } from "../hooks/usePivotExport.js";

type Props = {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onReset: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onExportHtml?: () => void;
  onExportChartPng?: () => void;
  onExportCsv?: () => void;
  exportDisabled?: boolean;
  chartExportDisabled?: boolean;
  isExporting?: boolean;
  exportingFormat?: PivotExportFormat | null;
  viewMode?: "table" | "chart";
  onViewModeChange?: (mode: "table" | "chart") => void;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  showColumnTotals?: boolean;
  onToggleColumnTotals?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

export function PivotToolbar({
  onExpandAll,
  onCollapseAll,
  onReset,
  onExportExcel,
  onExportPdf,
  onExportHtml,
  onExportChartPng,
  onExportCsv,
  exportDisabled = false,
  chartExportDisabled = false,
  isExporting = false,
  exportingFormat = null,
  viewMode = "table",
  onViewModeChange,
  activeFilterCount = 0,
  onClearFilters,
  showColumnTotals,
  onToggleColumnTotals,
  isFullscreen,
  onToggleFullscreen
}: Props) {
  const t = getPivotStrings().toolbar;
  const exportsLocked = exportDisabled || isExporting;
  const btn =
    "inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

  const exportIcon = (format: PivotExportFormat) =>
    isExporting && exportingFormat === format ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onViewModeChange && (
        <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 text-xs">
          <button
            type="button"
            className={`rounded px-2 py-1 ${viewMode === "table" ? "bg-zinc-100 font-medium" : ""}`}
            onClick={() => onViewModeChange("table")}
          >
            {t.table}
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 ${viewMode === "chart" ? "bg-zinc-100 font-medium" : ""}`}
            onClick={() => onViewModeChange("chart")}
            disabled={exportsLocked}
          >
            {t.chart}
          </button>
        </div>
      )}
      {onExportExcel && (
        <button
          type="button"
          className={btn}
          onClick={onExportExcel}
          disabled={exportsLocked}
        >
          {exportIcon("excel") ?? <FileSpreadsheet className="h-3.5 w-3.5" />}
          {t.excel}
        </button>
      )}
      {onExportCsv && (
        <button type="button" className={btn} onClick={onExportCsv} disabled={exportsLocked}>
          {exportIcon("csv") ?? <FileText className="h-3.5 w-3.5" />}
          {t.csv}
        </button>
      )}
      {onExportPdf && (
        <button type="button" className={btn} onClick={onExportPdf} disabled={exportsLocked}>
          {exportIcon("pdf") ?? <FileText className="h-3.5 w-3.5" />}
          {t.pdf}
        </button>
      )}
      {onExportHtml && (
        <button type="button" className={btn} onClick={onExportHtml} disabled={exportsLocked}>
          {exportIcon("html") ?? <FileCode className="h-3.5 w-3.5" />}
          {t.html}
        </button>
      )}
      {onExportChartPng && (
        <button
          type="button"
          className={btn}
          onClick={onExportChartPng}
          disabled={chartExportDisabled || isExporting}
        >
          {exportIcon("chartPng") ?? <FileImage className="h-3.5 w-3.5" />}
          {t.chartPng}
        </button>
      )}
      {onToggleFullscreen && (
        <button type="button" className={btn} onClick={onToggleFullscreen}>
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
          {isFullscreen ? t.exitFullscreen : t.fullscreen}
        </button>
      )}
      <button type="button" className={btn} onClick={onExpandAll}>
        <ChevronsUpDown className="h-3.5 w-3.5" />
        {t.expandAll}
      </button>
      <button type="button" className={btn} onClick={onCollapseAll}>
        <ChevronsDownUp className="h-3.5 w-3.5" />
        {t.collapseAll}
      </button>
      <button type="button" className={`${btn} border-transparent`} onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
        {t.reset}
      </button>
      {onToggleColumnTotals && (
        <button
          type="button"
          className={`${btn} ${showColumnTotals ? "bg-purple-50" : ""}`}
          onClick={onToggleColumnTotals}
        >
          {t.columnTotals}
        </button>
      )}
      {activeFilterCount > 0 && onClearFilters && (
        <button type="button" className={`${btn} bg-amber-50`} onClick={onClearFilters}>
          {t.clearFilters(activeFilterCount)}
        </button>
      )}
    </div>
  );
}

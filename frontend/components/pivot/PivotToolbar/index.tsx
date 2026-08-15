"use client";

import { ChevronsDownUp, ChevronsUpDown, Copy, FileCode, FileImage, FileSpreadsheet, FileText, Loader2, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { getPivotStrings } from "@salec/pivot-engine";
import { Button } from "@/components/ui/button";
import type { PivotExportFormat } from "@/hooks/pivot/usePivotExport";

type Props = {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onReset: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onExportHtml?: () => void;
  onExportChartPng?: () => void;
  onCopySelection?: () => void;
  copyDisabled?: boolean;
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
  className?: string;
};

export function PivotToolbar({
  onExpandAll,
  onCollapseAll,
  onReset,
  onExportExcel,
  onExportPdf,
  onExportHtml,
  onExportChartPng,
  onCopySelection,
  copyDisabled = false,
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
  onToggleFullscreen,
  className
}: Props) {
  const t = getPivotStrings().toolbar;
  const exportsLocked = exportDisabled || isExporting;

  const exportIcon = (format: PivotExportFormat) =>
    isExporting && exportingFormat === format ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {onViewModeChange && (
        <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
          <Button
            type="button"
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onViewModeChange("table")}
          >
            {t.table}
          </Button>
          <Button
            type="button"
            variant={viewMode === "chart" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onViewModeChange("chart")}
            disabled={exportsLocked}
          >
            {t.chart}
          </Button>
        </div>
      )}
      {onCopySelection && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={onCopySelection}
          disabled={copyDisabled}
          title="Копировать"
        >
          <Copy className="h-3.5 w-3.5" />
          Копировать
        </Button>
      )}
      {onExportExcel && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={onExportExcel}
          disabled={exportsLocked}
        >
          {exportIcon("excel") ?? <FileSpreadsheet className="h-3.5 w-3.5" />}
          {t.excel}
        </Button>
      )}
      {onExportPdf && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={onExportPdf}
          disabled={exportsLocked}
        >
          {exportIcon("pdf") ?? <FileText className="h-3.5 w-3.5" />}
          {t.pdf}
        </Button>
      )}
      {onExportHtml && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={onExportHtml}
          disabled={exportsLocked}
        >
          {exportIcon("html") ?? <FileCode className="h-3.5 w-3.5" />}
          {t.html}
        </Button>
      )}
      {onExportChartPng && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={onExportChartPng}
          disabled={chartExportDisabled || isExporting}
        >
          {exportIcon("chartPng") ?? <FileImage className="h-3.5 w-3.5" />}
          {t.chartPng}
        </Button>
      )}
      {onToggleFullscreen && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isFullscreen ? t.exitFullscreen : t.fullscreen}
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={onExpandAll}>
        <ChevronsUpDown className="h-3.5 w-3.5" />
        {t.expandAll}
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={onCollapseAll}>
        <ChevronsDownUp className="h-3.5 w-3.5" />
        {t.collapseAll}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
        {t.resetConfig}
      </Button>
      {onToggleColumnTotals && (
        <Button
          type="button"
          variant={showColumnTotals ? "secondary" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={onToggleColumnTotals}
        >
          {t.columnTotals}
        </Button>
      )}
      {activeFilterCount > 0 && onClearFilters && (
        <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={onClearFilters}>
          {t.clearFilters(activeFilterCount)}
        </Button>
      )}
    </div>
  );
}

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
export declare function PivotToolbar({ onExpandAll, onCollapseAll, onReset, onExportExcel, onExportPdf, onExportHtml, onExportChartPng, onExportCsv, exportDisabled, chartExportDisabled, isExporting, exportingFormat, viewMode, onViewModeChange, activeFilterCount, onClearFilters, showColumnTotals, onToggleColumnTotals, isFullscreen, onToggleFullscreen }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=PivotToolbar.d.ts.map
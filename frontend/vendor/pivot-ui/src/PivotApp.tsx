import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PivotConfig, PivotField } from "@salec/pivot-engine";
import {
  countPivotExportRows,
  getChartWarnings,
  getExportWarnings,
  getPivotStrings,
  hasChartableData,
  pivotToChartData,
  setPivotLocale,
  shouldConfirmLargeExport,
  type PivotChartType
} from "@salec/pivot-engine";
import { PivotBuilder } from "./components/PivotBuilder.js";
import { PivotChart } from "./components/PivotChart.js";
import { PivotDrillThrough } from "./components/PivotDrillThrough.js";
import { PivotTable } from "./components/PivotTable.js";
import { PivotToolbar } from "./components/PivotToolbar.js";
import { usePivot } from "./hooks/usePivot.js";
import { usePivotExport } from "./hooks/usePivotExport.js";
import { cn } from "./lib/cn.js";
import { resolveThemeTokens, type PivotThemeId } from "./themes/tokens.js";
import {
  resolveDrillThroughColumns,
  SALEC_DRILL_EXCLUDED,
  SALEC_DRILL_PREFERRED
} from "./drillColumns.js";
import "./pivot-ui.css";

export type PivotAppOptions = {
  /** Default false — Options / host must opt in */
  drillThrough?: boolean;
  locale?: "ru" | "uz";
  theme?: PivotThemeId;
  useWorker?: boolean;
  workerThreshold?: number;
  className?: string;
  style?: CSSProperties;
  drillColumnIds?: string[];
};

export type PivotAppProps = {
  data: Record<string, unknown>[];
  fields: PivotField[];
  config?: Partial<PivotConfig>;
  onConfigChange?: (config: PivotConfig) => void;
  options?: PivotAppOptions;
};

export function PivotApp({ data, fields, config: initialConfig, onConfigChange, options }: PivotAppProps) {
  const locale = options?.locale ?? "ru";
  useEffect(() => {
    setPivotLocale(locale);
  }, [locale]);

  const t = getPivotStrings();
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [chartType, setChartType] = useState<PivotChartType>("bar");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const drillThroughEnabled = options?.drillThrough === true;
  const theme = resolveThemeTokens(options?.theme ?? "default");

  const {
    config,
    pivotData,
    isComputing,
    expandedRows,
    addField,
    removeField,
    reorderFields,
    reorderValueFields,
    updateValueAggregation,
    setFilter,
    toggleRow,
    expandAll,
    collapseAll,
    resetConfig,
    setSortBy,
    drillOpen,
    drillRecords,
    drillCell,
    openDrillThrough,
    closeDrillThrough,
    addCalculatedPreset,
    removeCalculatedMeasure,
    activeFilterCount,
    clearAllFilters,
    toggleColumnTotals
  } = usePivot(data, fields, {
    initialConfig: {
      ...initialConfig,
      options: {
        showSubtotals: true,
        showGrandTotal: true,
        showColumnTotals: false,
        compactMode: false,
        drillDown: true,
        ...initialConfig?.options,
        drillThrough: drillThroughEnabled
      }
    },
    useWorker: options?.useWorker,
    workerThreshold: options?.workerThreshold
  });

  useEffect(() => {
    onConfigChange?.(config);
  }, [config, onConfigChange]);

  const tableConfig = useMemo(
    () => ({
      ...config,
      options: { ...config.options, drillThrough: drillThroughEnabled }
    }),
    [config, drillThroughEnabled]
  );

  const { exportExcel, exportPdf, exportHtml, exportChartPng, exportCsv, isExporting, exportFormat } =
    usePivotExport();

  const chartData = useMemo(() => (pivotData ? pivotToChartData(pivotData) : null), [pivotData]);
  const chartOk = Boolean(pivotData && chartData && hasChartableData(chartData));

  const confirmLargeExport = useCallback(() => {
    if (!pivotData) return false;
    if (!shouldConfirmLargeExport(pivotData, { expandedRows, sourceRowCount: data.length })) return true;
    const rows = countPivotExportRows(pivotData, { expandedRows });
    return window.confirm(getPivotStrings().export.confirmLargeExport(rows));
  }, [pivotData, expandedRows, data.length]);

  const drillFieldsOrdered = useMemo(() => {
    const ids =
      options?.drillColumnIds ??
      resolveDrillThroughColumns(drillRecords, fields, {
        preferred: SALEC_DRILL_PREFERRED,
        excluded: SALEC_DRILL_EXCLUDED,
        valueFieldId: drillCell?.drillContext?.valueFieldId
      });
    return ids.map(
      (id) => fields.find((f) => f.id === id) ?? { id, label: id, dataType: "string" as const }
    );
  }, [options?.drillColumnIds, drillRecords, fields, drillCell]);

  return (
    <div
      ref={containerRef}
      className={cn("salec-pivot-app flex min-h-[480px] flex-col gap-3 p-3", options?.className)}
      style={{ ...theme.cssVars, ...options?.style } as CSSProperties}
      data-theme={options?.theme ?? "default"}
    >
      <PivotToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onReset={resetConfig}
        onExportExcel={() => {
          if (!confirmLargeExport()) return;
          void exportExcel(pivotData, { expandedRows });
        }}
        onExportPdf={() => {
          if (!confirmLargeExport()) return;
          void exportPdf(pivotData, { expandedRows });
        }}
        onExportHtml={() => {
          if (!confirmLargeExport()) return;
          void exportHtml(pivotData, { expandedRows });
        }}
        onExportChartPng={() => void exportChartPng(chartRef.current)}
        onExportCsv={() => {
          if (!confirmLargeExport()) return;
          void exportCsv(pivotData, { expandedRows });
        }}
        exportDisabled={!pivotData}
        chartExportDisabled={!chartOk || viewMode !== "chart"}
        isExporting={isExporting}
        exportingFormat={exportFormat}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
        showColumnTotals={config.options.showColumnTotals}
        onToggleColumnTotals={toggleColumnTotals}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => {
          const el = containerRef.current;
          if (!el) return;
          if (!document.fullscreenElement) {
            void el.requestFullscreen?.();
            setIsFullscreen(true);
          } else {
            void document.exitFullscreen?.();
            setIsFullscreen(false);
          }
        }}
      />

      <div className="grid flex-1 gap-3 lg:grid-cols-[280px_1fr] pivot-mobile-stack">
        <PivotBuilder
          fields={fields}
          config={tableConfig}
          rawData={data}
          onAddField={addField}
          onRemoveField={removeField}
          onUpdateAggregation={updateValueAggregation}
          onSetFilter={setFilter}
          onAddCalculatedPreset={addCalculatedPreset}
          onRemoveCalculatedMeasure={removeCalculatedMeasure}
          onReorderFields={reorderFields}
          onReorderValueFields={reorderValueFields}
        />
        <div className="min-h-0 min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-[var(--pivot-border,#e4e4e7)] bg-[var(--pivot-surface,#fff)]">
          {viewMode === "table" && pivotData ? (
            <PivotTable
              data={pivotData}
              config={tableConfig}
              expandedRows={expandedRows}
              onToggleRow={toggleRow}
              onSort={setSortBy}
              onCellDoubleClick={drillThroughEnabled ? openDrillThrough : undefined}
              className="max-h-[70vh]"
            />
          ) : null}
          {viewMode === "chart" && chartData ? (
            <div ref={chartRef} className="p-3">
              <PivotChart data={chartData} chartType={chartType} onChartTypeChange={setChartType} />
            </div>
          ) : null}
          {!pivotData && !isComputing ? (
            <p className="p-6 text-sm text-zinc-500">{t.reportBuilder.dragMetricHint}</p>
          ) : null}
          {isComputing ? <p className="p-4 text-xs text-zinc-500">{t.reportBuilder.computing}</p> : null}
        </div>
      </div>

      {drillThroughEnabled ? (
        <PivotDrillThrough
          open={drillOpen}
          records={drillRecords}
          fields={drillFieldsOrdered}
          cellContext={drillCell?.drillContext}
          onClose={closeDrillThrough}
        />
      ) : null}

      {pivotData && chartData ? (
        <p className="sr-only">
          {[
            ...getExportWarnings(pivotData, { expandedRows, sourceRowCount: data.length }),
            ...getChartWarnings(pivotData, chartData, data.length)
          ].join(" ")}
        </p>
      ) : null}
    </div>
  );
}

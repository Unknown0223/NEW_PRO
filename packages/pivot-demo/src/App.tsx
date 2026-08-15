import { Loader2 } from "lucide-react";
import { SALES_DATA, generateSalesData } from "@/data/salesData";
import { DEFAULT_DEMO_CONFIG, SALES_FIELDS } from "@/data/salesFields";
import { PivotBuilder } from "@/components/PivotBuilder";
import { PivotChart } from "@/components/PivotChart";
import { PivotTable } from "@/components/PivotTable";
import { PivotDrillThrough } from "@/components/PivotDrillThrough";
import { PivotToolbar } from "@/components/PivotToolbar";
import { usePivot } from "@/hooks/usePivot";
import { usePivotExport } from "@/hooks/usePivotExport";
import { readPivotConfigFromUrl, usePivotUrlConfig } from "@/hooks/usePivotUrlConfig";
import { cn } from "@/lib/cn";
import { getPivotStrings, countPivotExportRows, getChartWarnings, getExportWarnings, hasChartableData, pivotToChartData, shouldConfirmLargeExport, type PivotChartType } from "@salec/pivot-engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const URL_CONFIG = readPivotConfigFromUrl();
const ROW_COUNT_PARAM = new URLSearchParams(window.location.search).get("rows");
const DEMO_ROW_COUNT = ROW_COUNT_PARAM ? Math.min(Number(ROW_COUNT_PARAM) || 480, 50_000) : 480;
const DEMO_DATA = DEMO_ROW_COUNT > 480 ? generateSalesData(DEMO_ROW_COUNT) : SALES_DATA;

const DEMO_CONDITIONAL_FORMATS = [
  { type: "negative" as const, backgroundColor: "#fee2e2", textColor: "#b91c1c" },
  { type: "gt" as const, fieldId: "amount", threshold: 500_000, backgroundColor: "#dcfce7" }
];

export function App() {
  const t = getPivotStrings();
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [chartType, setChartType] = useState<PivotChartType>("bar");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pivotContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const {
    config,
    pivotData,
    isComputing,
    usingWorker,
    expandedRows,
    addField,
    removeField,
    updateValueAggregation,
    setFilter,
    clearAllFilters,
    setSortBy,
    toggleRow,
    expandAll,
    collapseAll,
    resetConfig,
    hasData,
    activeFilterCount,
    drillOpen,
    drillRecords,
    drillCell,
    openDrillThrough,
    closeDrillThrough,
    addCalculatedPreset,
    removeCalculatedMeasure,
    toggleColumnTotals
  } = usePivot(DEMO_DATA, SALES_FIELDS, {
    initialConfig: {
      ...DEFAULT_DEMO_CONFIG,
      ...URL_CONFIG,
      options: {
        showSubtotals: true,
        showGrandTotal: true,
        showColumnTotals: false,
        compactMode: false,
        drillDown: true,
        conditionalFormats: DEMO_CONDITIONAL_FORMATS
      }
    }
  });

  usePivotUrlConfig(config);
  const { exportExcel, exportPdf, exportHtml, exportChartPng, isExporting, exportFormat, exportProgressLabel } =
    usePivotExport();

  const chartData = useMemo(
    () => (pivotData ? pivotToChartData(pivotData) : null),
    [pivotData]
  );

  const chartWarnings = useMemo(
    () => (pivotData && chartData ? getChartWarnings(pivotData, chartData, DEMO_DATA.length) : []),
    [pivotData, chartData]
  );

  const exportWarnings = useMemo(
    () =>
      pivotData
        ? getExportWarnings(pivotData, { expandedRows, sourceRowCount: DEMO_DATA.length })
        : [],
    [pivotData, expandedRows]
  );

  const confirmLargeExport = useCallback(() => {
    if (!pivotData) return false;
    if (
      !shouldConfirmLargeExport(pivotData, {
        expandedRows,
        sourceRowCount: DEMO_DATA.length
      })
    ) {
      return true;
    }
    const rows = countPivotExportRows(pivotData, { expandedRows });
    return window.confirm(getPivotStrings().export.confirmLargeExport(rows));
  }, [pivotData, expandedRows]);

  const handleExport = () => {
    if (!confirmLargeExport()) return;
    void exportExcel(pivotData, {
      filename: `pivot-demo-${new Date().toISOString().slice(0, 10)}.xlsx`,
      expandedRows,
      sheetName: "Pivot"
    });
  };

  const handleExportPdf = () => {
    if (!confirmLargeExport()) return;
    void exportPdf(pivotData, {
      filename: `pivot-demo-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "SavdoDesk Pivot",
      expandedRows
    });
  };

  const handleExportHtml = () => {
    if (!confirmLargeExport()) return;
    void exportHtml(pivotData, {
      filename: `pivot-demo-${new Date().toISOString().slice(0, 10)}.html`,
      title: "SavdoDesk Pivot",
      expandedRows
    });
  };

  const handleExportChartPng = useCallback(() => {
    void exportChartPng(chartRef.current, {
      filename: `pivot-chart-${new Date().toISOString().slice(0, 10)}.png`
    });
  }, [exportChartPng]);

  const handleToggleFullscreen = useCallback(() => {
    const el = pivotContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{t.demo.title}</h1>
            <p className="text-xs text-zinc-500">
              {t.demo.subtitle(
                DEMO_DATA.length.toLocaleString("ru-RU"),
                usingWorker,
                isComputing
              )}
            </p>
          </div>
          <PivotToolbar
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            onReset={resetConfig}
            onExportExcel={handleExport}
            onExportPdf={handleExportPdf}
            onExportHtml={handleExportHtml}
            onExportChartPng={viewMode === "chart" ? handleExportChartPng : undefined}
            exportDisabled={!hasData || isComputing}
            chartExportDisabled={
              !hasData || isComputing || !chartData || !hasChartableData(chartData)
            }
            isExporting={isExporting}
            exportingFormat={exportFormat}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearAllFilters}
            showColumnTotals={config.options.showColumnTotals}
            onToggleColumnTotals={toggleColumnTotals}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </div>
      </header>

      <main
        ref={pivotContainerRef}
        className={cn(
          "mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-3 p-4",
          isFullscreen && "max-w-none bg-white"
        )}
      >
        <p className="text-xs text-zinc-500">{t.demo.workerHint}</p>

        <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
          <PivotBuilder
            fields={SALES_FIELDS}
            config={config}
            rawData={DEMO_DATA}
            onAddField={addField}
            onRemoveField={removeField}
            onUpdateAggregation={updateValueAggregation}
            onSetFilter={setFilter}
            onAddCalculatedPreset={addCalculatedPreset}
            onRemoveCalculatedMeasure={removeCalculatedMeasure}
          />
        </section>

        {isComputing && (
          <p className="text-sm text-zinc-500">{t.demo.computing(usingWorker)}</p>
        )}

        {exportWarnings.length > 0 && (
          <div className="space-y-1">
            {exportWarnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-700">
                {warning}
              </p>
            ))}
          </div>
        )}

        {isExporting && exportProgressLabel && (
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {exportProgressLabel}
          </p>
        )}

        {pivotData && hasData && !isComputing ? (
          viewMode === "chart" && chartData && hasChartableData(chartData) ? (
            <PivotChart
              ref={chartRef}
              data={chartData}
              chartType={chartType}
              onChartTypeChange={setChartType}
              warnings={chartWarnings}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            />
          ) : viewMode === "chart" && chartData && !hasChartableData(chartData) ? (
            <p className="text-sm text-zinc-500">{t.chart.noData}</p>
          ) : (
            <PivotTable
              data={pivotData}
              config={config}
              expandedRows={expandedRows}
              onToggleRow={toggleRow}
              onSort={setSortBy}
              onCellDoubleClick={openDrillThrough}
              className="max-h-[calc(100vh-18rem)]"
            />
          )
        ) : !isComputing ? (
          <p className="text-sm text-zinc-500">{t.demo.addMetric}</p>
        ) : null}

        <PivotDrillThrough
          open={drillOpen}
          records={drillRecords}
          fields={[
            ...SALES_FIELDS,
            ...(config.calculatedMeasures ?? []).map((m) => ({
              id: m.id,
              label: m.label,
              dataType: "number" as const
            }))
          ]}
          cellContext={drillCell?.drillContext}
          onClose={closeDrillThrough}
        />
      </main>
    </div>
  );
}

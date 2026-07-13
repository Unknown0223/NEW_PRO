"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Eye, FileUp, Loader2, Save } from "lucide-react";
import { PivotBuilder } from "@/components/pivot/PivotBuilder";
import { PivotChart } from "@/components/pivot/PivotChart";
import { PivotDrillThrough } from "@/components/pivot/PivotDrillThrough";
import { PivotTable } from "@/components/pivot/PivotTable";
import { PivotToolbar } from "@/components/pivot/PivotToolbar";
import {
  ReportBuilderDatasetFiltersPanel,
  type ReportBuilderFilterOptions
} from "@/components/reports/report-builder-dataset-filters";
import { Button } from "@/components/ui/button";
import { usePivot } from "@/hooks/pivot/usePivot";
import { usePivotExport } from "@/hooks/pivot/usePivotExport";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import {
  detectSavedReportFormat,
  extractSavedDatasetFilters,
  fetchReportBuilderDataset,
  fetchReportBuilderMetadata,
  fetchReportBuilderSavedReports,
  metadataToPivotFields,
  savePivotConfigReport,
  savedReportConfigToPivotConfig,
  wdrSliceToPivotConfig,
  type ReportBuilderDatasetRequest
} from "@/lib/pivot-bridge";
import {
  defaultDatasetFilters,
  migrateLegacyReportBuilderConfigToWdrReport,
  type DatasetFiltersPayload
} from "@/lib/report-builder-wdr-migrate";
import { calculatedMeasuresToFields, countPivotExportRows, getChartWarnings, getExportWarnings, getPivotSliceTemplates, getPivotStrings, hasChartableData, pivotToChartData, shouldConfirmLargeExport, applyPivotSliceTemplate, type PivotChartType } from "@salec/pivot-engine";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";


const PIVOT_DEMO_URL = process.env.NEXT_PUBLIC_PIVOT_DEMO_URL ?? "http://127.0.0.1:5174";

export function VirtualPivotReportBuilder() {
  const rb = getPivotStrings().reportBuilder;
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [filters, setFilters] = useState<DatasetFiltersPayload>(() => defaultDatasetFilters());
  const [datasetRows, setDatasetRows] = useState<Record<string, unknown>[]>([]);
  const [activeSavedReportId, setActiveSavedReportId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [chartType, setChartType] = useState<PivotChartType>("bar");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pivotContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const wdrImportRef = useRef<HTMLInputElement>(null);

  const metaQ = useQuery({
    queryKey: ["report-builder-metadata", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: () => fetchReportBuilderMetadata(tenantSlug!)
  });

  const filtersQ = useQuery({
    queryKey: ["report-builder-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ReportBuilderFilterOptions }>(
        `/api/${tenantSlug}/reports/report-builder/filter-options`
      );
      return data.data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["tenant-settings-profile", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<Record<string, unknown>>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const savedQ = useQuery({
    queryKey: ["report-builder-saved", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: 30_000,
    queryFn: () => fetchReportBuilderSavedReports(tenantSlug!)
  });

  const pivotFields = useMemo(
    () => (metaQ.data ? metadataToPivotFields(metaQ.data) : []),
    [metaQ.data]
  );

  const {
    config,
    pivotData,
    isComputing,
    usingWorker,
    expandedRows,
    updateConfig,
    addField,
    removeField,
    reorderFields,
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
  } = usePivot(datasetRows, pivotFields);

  const { exportExcel, exportPdf, exportHtml, exportChartPng, isExporting, exportFormat, exportProgressLabel } =
    usePivotExport();

  const chartData = useMemo(
    () => (pivotData ? pivotToChartData(pivotData) : null),
    [pivotData]
  );

  const chartWarnings = useMemo(
    () =>
      pivotData && chartData ? getChartWarnings(pivotData, chartData, datasetRows.length) : [],
    [pivotData, chartData, datasetRows.length]
  );

  const exportWarnings = useMemo(
    () =>
      pivotData
        ? getExportWarnings(pivotData, { expandedRows, sourceRowCount: datasetRows.length })
        : [],
    [pivotData, expandedRows, datasetRows.length]
  );

  const confirmLargeExport = useCallback(() => {
    if (!pivotData) return false;
    if (
      !shouldConfirmLargeExport(pivotData, {
        expandedRows,
        sourceRowCount: datasetRows.length
      })
    ) {
      return true;
    }
    const rows = countPivotExportRows(pivotData, { expandedRows });
    return window.confirm(getPivotStrings().export.confirmLargeExport(rows));
  }, [pivotData, expandedRows, datasetRows.length]);

  const handleExportExcel = useCallback(() => {
    if (!confirmLargeExport()) return;
    void exportExcel(pivotData, {
      filename: `pivot-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      expandedRows,
      sheetName: "Pivot"
    });
  }, [confirmLargeExport, exportExcel, pivotData, expandedRows]);

  const handleExportPdf = useCallback(() => {
    if (!confirmLargeExport()) return;
    void exportPdf(pivotData, {
      filename: `pivot-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "SavdoDesk Pivot",
      expandedRows
    });
  }, [confirmLargeExport, exportPdf, pivotData, expandedRows]);

  const handleExportHtml = useCallback(() => {
    if (!confirmLargeExport()) return;
    void exportHtml(pivotData, {
      filename: `pivot-report-${new Date().toISOString().slice(0, 10)}.html`,
      title: "SavdoDesk Pivot",
      expandedRows
    });
  }, [confirmLargeExport, exportHtml, pivotData, expandedRows]);

  const handleExportChartPng = useCallback(() => {
    void exportChartPng(chartRef.current, {
      filename: `pivot-chart-${new Date().toISOString().slice(0, 10)}.png`
    });
  }, [exportChartPng]);

  const handleLoadSavedReport = useCallback(
    async (savedId: number, savedConfig: unknown) => {
      const restoredFilters = extractSavedDatasetFilters(savedConfig);
      if (restoredFilters) setFilters(restoredFilters);

      let pivotConfig = savedReportConfigToPivotConfig(savedConfig);
      if (!pivotConfig) {
        const legacy = savedConfig as Record<string, unknown>;
        if (legacy.rowFieldIds && legacy.metrics) {
          pivotConfig = savedReportConfigToPivotConfig(
            migrateLegacyReportBuilderConfigToWdrReport(savedConfig as never)
          );
        }
      }
      if (!pivotConfig) {
        setImportError(rb.savedReportIncompatible);
        return;
      }
      updateConfig(pivotConfig);
      setImportError(null);
      setActiveSavedReportId(savedId);

      if (tenantSlug) {
        const payload: ReportBuilderDatasetRequest = {
          ...(restoredFilters ?? filters),
          rowFieldIds: pivotConfig.rows,
          colFieldIds: pivotConfig.columns
        };
        try {
          const rows = await fetchReportBuilderDataset(tenantSlug, payload);
          setDatasetRows(rows);
          setLoadError(null);
        } catch (err) {
          setLoadError(getUserFacingError(err));
        }
      }
    },
    [filters, tenantSlug, updateConfig]
  );

  const handleWdrFileImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const json = JSON.parse(text) as unknown;
        const format = detectSavedReportFormat(json);
        if (format === "wdr") {
          handleLoadSavedReport(-1, json);
          return;
        }
        if (json && typeof json === "object" && "slice" in json) {
          updateConfig(wdrSliceToPivotConfig((json as { slice: object }).slice));
          setImportError(null);
          return;
        }
        setImportError(rb.wdrSliceNotFound);
      } catch {
        setImportError(rb.jsonReadError);
      }
    },
    [handleLoadSavedReport, updateConfig]
  );

  const loadMut = useMutation({
    mutationFn: async () => {
      const payload: ReportBuilderDatasetRequest = {
        ...filters,
        rowFieldIds: config.rows,
        colFieldIds: config.columns
      };
      return fetchReportBuilderDataset(tenantSlug!, payload);
    },
    onSuccess: (rows) => {
      setDatasetRows(rows);
      setLoadError(null);
    },
    onError: (err) => setLoadError(getUserFacingError(err))
  });

  const handleLoadData = useCallback(() => {
    if (!tenantSlug) return;
    loadMut.mutate();
  }, [tenantSlug, loadMut]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const name = window.prompt(rb.savePrompt, `Pivot ${new Date().toLocaleDateString("uz-UZ")}`);
      if (!name?.trim()) throw new Error("CANCELLED");
      return savePivotConfigReport(tenantSlug!, name.trim(), config, filters);
    },
    onSuccess: () => {
      setSaveError(null);
      void savedQ.refetch();
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "CANCELLED") return;
      setSaveError(getUserFacingError(err));
    }
  });

  const drillFields = useMemo(
    () => [...pivotFields, ...calculatedMeasuresToFields(config.calculatedMeasures ?? [])],
    [pivotFields, config.calculatedMeasures]
  );

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
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{rb.title}</h1>
          <p className="text-xs text-muted-foreground">{rb.subtitle}</p>
        </div>
        <Link
          href={PIVOT_DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {rb.fullDemo}
        </Link>
      </div>

      <ReportBuilderDatasetFiltersPanel
        filters={filters}
        onFiltersChange={setFilters}
        filterOptions={filtersQ.data}
        dateModes={metaQ.data?.dateModes}
        profileData={profileQ.data}
        title={rb.datasetFilters}
        actions={
          <Button
            size="sm"
            className="h-9 min-w-[8.5rem] gap-1 bg-[#2D948A] text-white hover:bg-[#268a7f]"
            onClick={handleLoadData}
            disabled={loadMut.isPending || !config.values.length}
          >
            {loadMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {rb.loadData}
          </Button>
        }
      />

      {savedQ.data && savedQ.data.length > 0 && (
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <span className="mb-1 block text-[10px] text-muted-foreground">{rb.savedReports}</span>
          <div className="flex max-w-full flex-wrap gap-1">
            {savedQ.data.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant={activeSavedReportId === s.id ? "default" : "outline"}
                size="sm"
                className="h-7 max-w-[180px] truncate text-[10px]"
                title={s.name}
                onClick={() => void handleLoadSavedReport(s.id, s.config)}
              >
                {s.name}
                {detectSavedReportFormat(s.config) === "wdr" ? rb.savedReportWdrSuffix : ""}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-muted-foreground">{rb.wdrImport}</span>
        <input
          ref={wdrImportRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleWdrFileImport(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => wdrImportRef.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5" />
          {rb.wdrSliceJson}
        </Button>
      </div>

      <div
        ref={pivotContainerRef}
        className={`flex min-h-0 flex-1 flex-col gap-2 rounded-md border border-border bg-card p-3${isFullscreen ? " bg-background" : ""}`}
      >
        <PivotToolbar
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onReset={resetConfig}
          onExportExcel={handleExportExcel}
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

        {exportWarnings.length > 0 && (
          <div className="space-y-1">
            {exportWarnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-700 dark:text-amber-400">
                {warning}
              </p>
            ))}
          </div>
        )}

        {isExporting && exportProgressLabel && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {exportProgressLabel}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{rb.sliceTemplatesLabel}:</span>
          {getPivotSliceTemplates().map((template) => (
            <Button
              key={template.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              title={template.description}
              disabled={!pivotFields.length}
              onClick={() => {
                const next = applyPivotSliceTemplate(template.id, pivotFields, config);
                if (next) updateConfig(next);
              }}
            >
              {template.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={!config.values.length || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {rb.save}
          </Button>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>

        {(isComputing || usingWorker) && (
          <p className="text-xs text-muted-foreground">
            {isComputing ? rb.computing : null}
            {usingWorker ? rb.workerActive : null}
          </p>
        )}

        {metaQ.isLoading ? (
          <p className="text-sm text-muted-foreground">{rb.loadingMetadata}</p>
        ) : (
          <PivotBuilder
            fields={pivotFields}
            config={config}
            rawData={datasetRows}
            onAddField={addField}
            onRemoveField={removeField}
            onUpdateAggregation={updateValueAggregation}
            onSetFilter={setFilter}
            onAddCalculatedPreset={addCalculatedPreset}
            onRemoveCalculatedMeasure={removeCalculatedMeasure}
            onReorderFields={reorderFields}
            layout="wdr"
          />
        )}

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {importError && <p className="text-sm text-destructive">{importError}</p>}

        {!config.values.length && (
          <p className="text-sm text-muted-foreground">
            {rb.dragMetricHint}
          </p>
        )}

        {pivotData && hasData && !isComputing &&
          (viewMode === "chart" && chartData && hasChartableData(chartData) ? (
            <PivotChart
              ref={chartRef}
              data={chartData}
              chartType={chartType}
              onChartTypeChange={setChartType}
              warnings={chartWarnings}
              className="rounded-md border border-border bg-background p-2"
            />
          ) : viewMode === "chart" && chartData && !hasChartableData(chartData) ? (
            <p className="text-sm text-muted-foreground">{getPivotStrings().chart.noData}</p>
          ) : (
            <PivotTable
              data={pivotData}
              config={config}
              expandedRows={expandedRows}
              onToggleRow={toggleRow}
              onSort={setSortBy}
              onCellDoubleClick={openDrillThrough}
              className="max-h-[calc(100vh-20rem)]"
            />
          ))}

        <PivotDrillThrough
          open={drillOpen}
          records={drillRecords}
          fields={drillFields}
          cellContext={drillCell?.drillContext}
          onClose={closeDrillThrough}
        />
      </div>
    </div>
  );
}
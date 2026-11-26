"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ConditionalFormatRule, PivotConfig } from "@salec/pivot-engine";
import { hasChartableData } from "@salec/pivot-engine";
import { usePermissions } from "@/lib/use-permissions";
import {
  applyOptionsDefaults,
  buildEmptyDraft
} from "@/components/reports/flat-report/flat-report-helpers";
import { FlatReportFilters } from "@/components/reports/flat-report/flat-report-filters";
import { PivotChart } from "@/components/pivot/PivotChart";
import { PivotTable, type PivotTableHandle } from "@/components/pivot/PivotTable";
import type { LayoutOptionsSelection } from "@/components/reports/virtual-pivot-layout-options-dialog";
import { usePivotExport } from "@/hooks/pivot/usePivotExport";
import {
  WDR_DEFAULT_TABLE_STYLE_ID,
  loadPivotTableStyleId,
  persistPivotTableStyleId
} from "@/lib/pivot-table-styles";
import { cn } from "@/lib/utils";
import {
  applyUniversalBonusesLayoutOptions,
  buildUniversalBonusesFlatPivotConfig,
  selectionFromConfig
} from "./universal-bonuses-pivot-fields";
import { UniversalBonusesPivotDialogs } from "./universal-bonuses-pivot-dialogs";
import { UniversalBonusesPivotSavedChrome } from "./universal-bonuses-pivot-saved-chrome";
import {
  UniversalBonusesPivotToolbar,
  type UniversalBonusesPivotToolbarMenu
} from "./universal-bonuses-pivot-toolbar";
import { useUniversalBonusesPivot } from "./use-universal-bonuses-pivot";

export function UniversalBonusesVirtualPivotWorkspace() {
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [dateFormatOpen, setDateFormatOpen] = useState(false);
  const [formatCellsOpen, setFormatCellsOpen] = useState(false);
  const [conditionalOpen, setConditionalOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [layoutInitial, setLayoutInitial] = useState<LayoutOptionsSelection>(() =>
    selectionFromConfig(buildUniversalBonusesFlatPivotConfig())
  );
  const [draftConditionalRules, setDraftConditionalRules] = useState<ConditionalFormatRule[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [toolbarMenu, setToolbarMenu] = useState<UniversalBonusesPivotToolbarMenu>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tableStyleId, setTableStyleId] = useState(WDR_DEFAULT_TABLE_STYLE_ID);
  const [fieldsSnapshot, setFieldsSnapshot] = useState<PivotConfig>(() =>
    buildUniversalBonusesFlatPivotConfig()
  );
  const pivotTableRef = useRef<PivotTableHandle>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const { exportExcel, exportCsv, exportPdf, exportHtml, exportChartPng, isExporting } =
    usePivotExport();
  const canExport = usePermissions().has(
    "reports.universalnyy_bonus.export"
  );
  const {
    cfg,
    from0,
    to0,
    draft,
    setDraft,
    setApplied,
    filtersQ,
    datasetQ,
    pivotFields,
    rawRows,
    pivot,
    currentLayoutForm,
    layoutLabel,
    expandableRowKeys,
    hierarchyExpanded,
    chartData,
    filterSummaries,
    multiItemsByKey,
    dateTypeField,
    dateTypeOptions
  } = useUniversalBonusesPivot(fieldsOpen);

  const {
    config,
    pivotData,
    isComputing,
    expandedRows,
    updateConfig,
    addField,
    removeField,
    reorderFields,
    setFlatColumnOrder,
    updateValueAggregation,
    setFilter,
    toggleRow,
    setSortBy,
    expandAll,
    collapseAll,
    hasData,
    addCalculatedPreset,
    addCalculatedMeasure,
    removeCalculatedMeasure,
    updateCalculatedMeasure,
    toggleColumnTotals
  } = pivot;

  useEffect(() => {
    setTableStyleId(loadPivotTableStyleId());
  }, []);

  const stamp = () => new Date().toISOString().slice(0, 10);
  const onApplyLayout = useCallback(
    (sel: LayoutOptionsSelection) => {
      const next = applyUniversalBonusesLayoutOptions(config, sel);
      updateConfig(next);
      if (sel.layoutForm === "flat") collapseAll();
      if (sel.layoutForm === "classic" && expandableRowKeys.length <= 2_000) {
        window.setTimeout(() => expandAll(), 0);
      }
      setOptionsOpen(false);
      setViewMode("table");
    },
    [collapseAll, config, expandAll, expandableRowKeys.length, updateConfig]
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-3 p-4",
        isFullscreen && "fixed inset-0 z-50 overflow-auto bg-background"
      )}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{cfg.title}</h1>
        <p className="text-sm text-muted-foreground">
          SavdoDesk Virtual Pivot ·{" "}
          {datasetQ.data
            ? `строк: ${datasetQ.data.rows.length}${
                datasetQ.data.truncated ? ` / ${datasetQ.data.total}` : ""
              }`
            : "—"}
        </p>
      </div>

      {datasetQ.data?.truncated ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          Показаны {datasetQ.data.rows.length.toLocaleString("ru-RU")} из{" "}
          {datasetQ.data.total.toLocaleString("ru-RU")} строк. Итоги pivot только по
          загруженным строкам — сузьте фильтр или период.
        </div>
      ) : null}

      <FlatReportFilters
        config={cfg}
        draft={draft}
        setDraft={setDraft}
        filterOptions={filtersQ.data}
        multiItemsByKey={multiItemsByKey}
        dateTypeField={dateTypeField}
        dateTypeAsRadio={Boolean(cfg.dateTypeAsRadio)}
        dateTypeOptions={dateTypeOptions}
        canExport={false}
        exporting={false}
        fetching={datasetQ.isFetching}
        onReset={() => {
          const empty = buildEmptyDraft(cfg.filterFields, from0, to0, 50);
          const next = filtersQ.data
            ? applyOptionsDefaults(empty, cfg.filterFields, filtersQ.data)
            : empty;
          setDraft(next);
          setApplied(next);
        }}
        onApply={() => setApplied(draft)}
        onExport={() => undefined}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-md border border-border bg-card p-3">
        <UniversalBonusesPivotToolbar
          layoutLabel={layoutLabel}
          canExport={canExport}
          hasData={hasData}
          isComputing={isComputing || datasetQ.isFetching}
          isExporting={isExporting}
          isFullscreen={isFullscreen}
          hierarchyExpanded={hierarchyExpanded}
          hierarchyDisabled={
            isComputing || !hasData || expandableRowKeys.length === 0 || currentLayoutForm === "flat"
          }
          toolbarMenu={toolbarMenu}
          setToolbarMenu={setToolbarMenu}
          tableStyleId={tableStyleId}
          onTableStyle={(id) => {
            setTableStyleId(id);
            persistPivotTableStyleId(id);
          }}
          onClearTableStyle={() => {
            setTableStyleId(WDR_DEFAULT_TABLE_STYLE_ID);
            persistPivotTableStyleId(WDR_DEFAULT_TABLE_STYLE_ID);
          }}
          onExportExcel={() =>
            void exportExcel(pivotData, {
              filename: `universal-bonuses-${stamp()}.xlsx`,
              expandedRows
            })
          }
          onExportCsv={() =>
            void exportCsv(pivotData, { filename: `universal-bonuses-${stamp()}.csv` })
          }
          onExportPdf={() =>
            void exportPdf(pivotData, {
              filename: `universal-bonuses-${stamp()}.pdf`,
              title: cfg.title
            })
          }
          onExportHtml={() =>
            void exportHtml(pivotData, {
              filename: `universal-bonuses-${stamp()}.html`,
              title: cfg.title
            })
          }
          showExportPng={viewMode === "chart"}
          onExportPng={() =>
            void exportChartPng(chartRef.current, {
              filename: `universal-bonuses-${stamp()}.png`
            })
          }
          onCopy={() => void pivotTableRef.current?.copySelection()}
          onToggleHierarchy={() => {
            if (hierarchyExpanded) collapseAll();
            else if (expandableRowKeys.length <= 2_000) expandAll();
          }}
          onOpenDateFormat={() => setDateFormatOpen(true)}
          onOpenFormatMenu={() => setToolbarMenu(toolbarMenu === "format" ? null : "format")}
          onOpenCellFormat={() => setFormatCellsOpen(true)}
          onOpenConditional={() => {
            setDraftConditionalRules([...(config.options.conditionalFormats ?? [])]);
            setConditionalOpen(true);
          }}
          onViewTable={() => setViewMode("table")}
          onViewChart={() => setViewMode("chart")}
          onToggleColumnTotals={toggleColumnTotals}
          onOpenOptions={() => {
            setLayoutInitial(selectionFromConfig(config));
            setOptionsOpen(true);
          }}
          onOpenFields={() => {
            setFieldsSnapshot(config);
            setFieldsOpen(true);
          }}
          onToggleFullscreen={() => setIsFullscreen((v) => !v)}
          savedChrome={
            <UniversalBonusesPivotSavedChrome config={config} onLoadConfig={updateConfig} />
          }
        />

        {(datasetQ.isFetching || isComputing) && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Обновление…
          </span>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {viewMode === "chart" && chartData && hasChartableData(chartData) ? (
            <PivotChart
              ref={chartRef}
              data={chartData}
              chartType="bar"
              className="h-full min-h-[280px]"
            />
          ) : viewMode === "chart" ? (
            <p className="p-6 text-sm text-muted-foreground">
              Нет данных для диаграммы — Формат → Таблица.
            </p>
          ) : pivotData && hasData ? (
            <PivotTable
              ref={pivotTableRef}
              data={pivotData}
              config={config}
              expandedRows={expandedRows}
              onToggleRow={toggleRow}
              onSort={setSortBy}
              fields={pivotFields}
              rawData={rawRows}
              onSetFilter={setFilter}
              onReorderFlatColumns={setFlatColumnOrder}
              tableStyleId={tableStyleId}
              className="h-full"
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              {datasetQ.isLoading
                ? "Загрузка…"
                : rawRows.length === 0
                  ? "Нет данных за выбранный период. Проверьте даты и нажмите «Применить»."
                  : isComputing
                    ? "Расчёт сводной…"
                    : "Нет строк — откройте «Поля» или «Опции» → Настройки разметки."}
            </p>
          )}
        </div>
      </div>

      <UniversalBonusesPivotDialogs
        fieldsOpen={fieldsOpen}
        setFieldsOpen={setFieldsOpen}
        currentLayoutForm={currentLayoutForm}
        pivotFields={pivotFields}
        config={config}
        fieldsSnapshot={fieldsSnapshot}
        filterSummaries={filterSummaries}
        pivotHandlers={{
          addField,
          removeField,
          updateValueAggregation,
          addCalculatedPreset,
          addCalculatedMeasure,
          updateCalculatedMeasure,
          removeCalculatedMeasure,
          reorderFields,
          setFlatColumnOrder,
          updateConfig
        }}
        expandAll={expandAll}
        optionsOpen={optionsOpen}
        setOptionsOpen={setOptionsOpen}
        layoutInitial={layoutInitial}
        onApplyLayout={onApplyLayout}
        formatCellsOpen={formatCellsOpen}
        setFormatCellsOpen={setFormatCellsOpen}
        conditionalOpen={conditionalOpen}
        setConditionalOpen={setConditionalOpen}
        draftConditionalRules={draftConditionalRules}
        setDraftConditionalRules={setDraftConditionalRules}
        dateFormatOpen={dateFormatOpen}
        setDateFormatOpen={setDateFormatOpen}
      />
    </div>
  );
}

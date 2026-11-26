"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ConditionalFormatRule, PivotConfig, PivotField } from "@salec/pivot-engine";
import {
  collectExpandableRowKeys,
  hasChartableData,
  pivotToChartData,
  summarizePivotFilter
} from "@salec/pivot-engine";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { FlatReportFilters } from "@/components/reports/flat-report/flat-report-filters";
import {
  appendParams,
  applyOptionsDefaults,
  buildEmptyDraft,
  mapMultiOptions
} from "@/components/reports/flat-report/flat-report-helpers";
import { PivotChart } from "@/components/pivot/PivotChart";
import { PivotTable, type PivotTableHandle } from "@/components/pivot/PivotTable";
import type { LayoutOptionsSelection } from "@/components/reports/virtual-pivot-layout-options-dialog";
import { TasksPivotDialogs } from "./tasks-pivot-dialogs";
import { usePivot } from "@/hooks/pivot/usePivot";
import { usePivotExport } from "@/hooks/pivot/usePivotExport";
import { resolveLayoutForm } from "@/lib/pivot-layout-form";
import {
  WDR_DEFAULT_TABLE_STYLE_ID,
  loadPivotTableStyleId,
  persistPivotTableStyleId
} from "@/lib/pivot-table-styles";
import { cn } from "@/lib/utils";
import { TASKS_FILTER_CONFIG } from "./tasks-filter-config";
import {
  applyTasksLayoutOptions,
  buildTasksFlatPivotConfig,
  selectionFromConfig,
  TASKS_PIVOT_FIELDS
} from "./tasks-pivot-fields";
import { TasksPivotSavedChrome } from "./tasks-pivot-saved-chrome";
import { TasksPivotToolbar, type TasksPivotToolbarMenu } from "./tasks-pivot-toolbar";

type DatasetPayload = {
  fields: Array<{ id: string; label: string; dataType: string }>;
  rows: Record<string, unknown>[];
  total: number;
  truncated: boolean;
};

export function TasksVirtualPivotWorkspace() {
  const cfg = TASKS_FILTER_CONFIG;
  const canExport = usePermissions().has(cfg.exportPermission);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [dateFormatOpen, setDateFormatOpen] = useState(false);
  const [formatCellsOpen, setFormatCellsOpen] = useState(false);
  const [conditionalOpen, setConditionalOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [layoutInitial, setLayoutInitial] = useState<LayoutOptionsSelection>(() =>
    selectionFromConfig(buildTasksFlatPivotConfig())
  );
  const [draftConditionalRules, setDraftConditionalRules] = useState<ConditionalFormatRule[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [toolbarMenu, setToolbarMenu] = useState<TasksPivotToolbarMenu>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tableStyleId, setTableStyleId] = useState(WDR_DEFAULT_TABLE_STYLE_ID);
  const [draft, setDraft] = useState(() => buildEmptyDraft(cfg.filterFields, from0, to0, 50));
  const [applied, setApplied] = useState(draft);
  const [fieldsSnapshot, setFieldsSnapshot] = useState<PivotConfig>(() => buildTasksFlatPivotConfig());
  const pivotTableRef = useRef<PivotTableHandle>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const { exportExcel, exportCsv, exportPdf, exportHtml, exportChartPng, isExporting } =
    usePivotExport();

  useEffect(() => {
    setTableStyleId(loadPivotTableStyleId());
  }, []);

  const filtersQ = useQuery({
    queryKey: ["report-tasks-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Record<string, unknown> }>(
        `/api/${tenantSlug}/reports/tasks/filter-options`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (!filtersQ.data) return;
    setDraft((d) => applyOptionsDefaults(d, cfg.filterFields, filtersQ.data));
    setApplied((a) => applyOptionsDefaults(a, cfg.filterFields, filtersQ.data));
  }, [filtersQ.data, cfg.filterFields]);

  const datasetQ = useQuery({
    queryKey: ["report-tasks-dataset", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, { ...applied, page: 1, limit: 5000 });
      const { data } = await api.get<{ data: DatasetPayload }>(
        `/api/${tenantSlug}/reports/tasks/dataset?${p.toString()}`
      );
      return data.data;
    }
  });

  const pivotFields: PivotField[] = useMemo(() => {
    const fromApi = datasetQ.data?.fields;
    if (!fromApi?.length) return TASKS_PIVOT_FIELDS;
    return fromApi.map((f) => ({
      id: f.id,
      label: f.label,
      dataType: (f.dataType as PivotField["dataType"]) || "string"
    }));
  }, [datasetQ.data?.fields]);

  const rawRows = datasetQ.data?.rows ?? [];

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
  } = usePivot(rawRows, pivotFields, {
    initialConfig: buildTasksFlatPivotConfig(),
    suspendCompute: fieldsOpen
  });

  const currentLayoutForm = resolveLayoutForm(config.options);
  const layoutLabel =
    currentLayoutForm === "flat"
      ? "Табличная"
      : currentLayoutForm === "compact"
        ? "Компактная"
        : "Классическая";

  const expandableRowKeys = useMemo(
    () => (pivotData?.rows?.length ? collectExpandableRowKeys(pivotData.rows) : []),
    [pivotData]
  );
  const hierarchyExpanded =
    expandableRowKeys.length > 0 && expandableRowKeys.some((key) => expandedRows.has(key));

  const chartData = useMemo(
    () => (pivotData ? pivotToChartData(pivotData) : null),
    [pivotData]
  );

  const filterSummaries = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of config.filters) {
      const summary = summarizePivotFilter(f);
      if (summary) map[f.fieldId] = summary;
    }
    return map;
  }, [config.filters]);

  const multiItemsByKey = useMemo(() => {
    const opts = filtersQ.data;
    const map: Record<string, ReturnType<typeof mapMultiOptions>> = {};
    for (const field of cfg.filterFields) {
      if (field.kind !== "multiSelect") continue;
      map[field.paramKey] = mapMultiOptions(opts?.[field.optionsFrom]);
    }
    return map;
  }, [filtersQ.data, cfg.filterFields]);

  const stamp = () => new Date().toISOString().slice(0, 10);

  const onApplyLayout = useCallback(
    (sel: LayoutOptionsSelection) => {
      const next = applyTasksLayoutOptions(config, sel);
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

      <FlatReportFilters
        config={cfg}
        draft={draft}
        setDraft={setDraft}
        filterOptions={filtersQ.data}
        multiItemsByKey={multiItemsByKey}
        dateTypeField={undefined}
        dateTypeAsRadio={false}
        dateTypeOptions={[]}
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
        <TasksPivotToolbar
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
            void exportExcel(pivotData, { filename: `tasks-${stamp()}.xlsx`, expandedRows })
          }
          onExportCsv={() => void exportCsv(pivotData, { filename: `tasks-${stamp()}.csv` })}
          onExportPdf={() =>
            void exportPdf(pivotData, { filename: `tasks-${stamp()}.pdf`, title: cfg.title })
          }
          onExportHtml={() =>
            void exportHtml(pivotData, { filename: `tasks-${stamp()}.html`, title: cfg.title })
          }
          showExportPng={viewMode === "chart"}
          onExportPng={() =>
            void exportChartPng(chartRef.current, { filename: `tasks-${stamp()}.png` })
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
          savedChrome={<TasksPivotSavedChrome config={config} onLoadConfig={updateConfig} />}
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

      <TasksPivotDialogs
        fieldsOpen={fieldsOpen}
        setFieldsOpen={setFieldsOpen}
        currentLayoutForm={currentLayoutForm}
        pivotFields={pivotFields}
        config={config}
        fieldsSnapshot={fieldsSnapshot}
        filterSummaries={filterSummaries}
        pivotHandlers={{
          addField, removeField, updateValueAggregation, addCalculatedPreset,
          addCalculatedMeasure, updateCalculatedMeasure, removeCalculatedMeasure,
          reorderFields, setFlatColumnOrder, updateConfig
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

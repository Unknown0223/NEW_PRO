"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { PivotConfig, PivotField } from "@salec/pivot-engine";
import { summarizePivotFilter } from "@salec/pivot-engine";
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
import { PivotTable, type PivotTableHandle } from "@/components/pivot/PivotTable";
import { VirtualPivotFieldsModal } from "@/components/reports/virtual-pivot-fields-modal";
import {
  DEFAULT_CELL_FORMAT,
  VirtualPivotFormatCellsDialog,
  applyCellFormatToConfig,
  cellFormatFromConfig
} from "@/components/reports/virtual-pivot-format-dialogs";
import { VirtualPivotDateFormatDialog } from "@/components/reports/virtual-pivot-date-format-dialog";
import {
  DEFAULT_PIVOT_DATE_FORMAT,
  applyDateFormatToConfig,
  dateFormatStateFromConfig
} from "@/lib/pivot-date-format";
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
  buildTasksClassicPivotConfig,
  buildTasksFlatPivotConfig,
  TASKS_PIVOT_FIELDS
} from "./tasks-pivot-fields";
import {
  TasksPivotToolbar,
  type TasksPivotToolbarMenu
} from "./tasks-pivot-toolbar";

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
  const [toolbarMenu, setToolbarMenu] = useState<TasksPivotToolbarMenu>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tableStyleId, setTableStyleId] = useState(WDR_DEFAULT_TABLE_STYLE_ID);
  const [draft, setDraft] = useState(() => buildEmptyDraft(cfg.filterFields, from0, to0, 50));
  const [applied, setApplied] = useState(draft);
  const [fieldsSnapshot, setFieldsSnapshot] = useState<PivotConfig>(() => buildTasksFlatPivotConfig());
  const pivotTableRef = useRef<PivotTableHandle>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const { exportExcel, exportCsv, exportPdf, exportHtml, isExporting } = usePivotExport();

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
    hasData,
    addCalculatedPreset,
    addCalculatedMeasure,
    removeCalculatedMeasure,
    updateCalculatedMeasure
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

  const onExportExcel = useCallback(() => {
    void exportExcel(pivotData, {
      filename: `otchet-po-zadacham-${stamp()}.xlsx`,
      expandedRows
    });
  }, [exportExcel, pivotData, expandedRows]);

  const onExportCsv = useCallback(() => {
    void exportCsv(pivotData, { filename: `otchet-po-zadacham-${stamp()}.csv` });
  }, [exportCsv, pivotData]);

  const onExportPdf = useCallback(() => {
    void exportPdf(pivotData, {
      filename: `otchet-po-zadacham-${stamp()}.pdf`,
      title: cfg.title
    });
  }, [exportPdf, pivotData, cfg.title]);

  const onExportHtml = useCallback(() => {
    void exportHtml(pivotData, {
      filename: `otchet-po-zadacham-${stamp()}.html`,
      title: cfg.title
    });
  }, [exportHtml, pivotData, cfg.title]);

  return (
    <div
      ref={shellRef}
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
          onExportExcel={onExportExcel}
          onExportCsv={onExportCsv}
          onExportPdf={onExportPdf}
          onExportHtml={onExportHtml}
          onCopy={() => void pivotTableRef.current?.copySelection()}
          onOpenDateFormat={() => setDateFormatOpen(true)}
          onOpenCellFormat={() => setFormatCellsOpen(true)}
          onOpenFields={() => {
            setFieldsSnapshot(config);
            setFieldsOpen(true);
          }}
          onToggleFullscreen={() => setIsFullscreen((v) => !v)}
          onSetLayoutFlat={() => updateConfig(buildTasksFlatPivotConfig(config))}
          onSetLayoutClassic={() => updateConfig(buildTasksClassicPivotConfig(config))}
        />

        {(datasetQ.isFetching || isComputing) && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Обновление…
          </span>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {pivotData && hasData ? (
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
                    : currentLayoutForm === "classic" && !config.values.length
                      ? "Классическая форма: добавьте поле в «Значения» (Поля) или выберите «Табличная форма»."
                      : "Нет строк для отображения — откройте «Поля» или переключите «Опции» → Табличная форма."}
            </p>
          )}
        </div>
      </div>

      <VirtualPivotFieldsModal
        open={fieldsOpen}
        schema={currentLayoutForm}
        fields={pivotFields}
        config={config}
        onAddField={addField}
        onRemoveField={removeField}
        onUpdateAggregation={updateValueAggregation}
        onAddCalculatedPreset={addCalculatedPreset}
        onAddCalculatedMeasure={addCalculatedMeasure}
        onUpdateCalculatedMeasure={updateCalculatedMeasure}
        onRemoveCalculatedMeasure={removeCalculatedMeasure}
        onReorderFields={reorderFields}
        onValuesAxisLayoutChange={(layout) => {
          updateConfig({
            options: {
              ...config.options,
              valuesPosition: layout.position,
              valuesAxisIndex: layout.valuesAxisIndex
            }
          });
          if (layout.position === "rows") window.setTimeout(() => expandAll(), 0);
        }}
        onSetFlatColumnOrder={setFlatColumnOrder}
        onConfigureFilter={() => undefined}
        filterSummaries={filterSummaries}
        onApply={() => setFieldsOpen(false)}
        onCancel={() => {
          updateConfig(fieldsSnapshot);
          setFieldsOpen(false);
        }}
      />

      <VirtualPivotFormatCellsDialog
        open={formatCellsOpen}
        onOpenChange={setFormatCellsOpen}
        initial={{ ...DEFAULT_CELL_FORMAT, ...cellFormatFromConfig(config) }}
        valueFields={config.values.map((v) => ({
          id: v.fieldId,
          label: pivotFields.find((f) => f.id === v.fieldId)?.label ?? v.label ?? v.fieldId
        }))}
        onApply={(state) => {
          updateConfig(applyCellFormatToConfig(config, state));
          setFormatCellsOpen(false);
        }}
      />

      <VirtualPivotDateFormatDialog
        open={dateFormatOpen}
        onOpenChange={setDateFormatOpen}
        initial={dateFormatStateFromConfig(config) ?? DEFAULT_PIVOT_DATE_FORMAT}
        onApply={(state) => {
          updateConfig(applyDateFormatToConfig(config, pivotFields, state));
        }}
      />
    </div>
  );
}

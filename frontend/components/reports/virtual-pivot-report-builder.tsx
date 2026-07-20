"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Download,
  Eye,
  FolderOpen,
  Loader2,
  Maximize2,
  Minimize2,
  Copy,
  CalendarCog,
  Save,
  Settings2,
  SlidersHorizontal,
  TableProperties
} from "lucide-react";
import { PivotChart } from "@/components/pivot/PivotChart";
import { PivotDrillThrough } from "@/components/pivot/PivotDrillThrough";
import { FilterEditor } from "@/components/pivot/PivotFilters";
import { PivotTable, type PivotTableHandle } from "@/components/pivot/PivotTable";
import {
  TableStyleGallery,
  TableStyleToolbarIcon
} from "@/components/pivot/PivotTable/TableStyleGallery";
import {
  ReportBuilderDatasetFiltersPanel,
  type ReportBuilderFilterOptions
} from "@/components/reports/report-builder-dataset-filters";
import { VirtualPivotFieldsModal } from "@/components/reports/virtual-pivot-fields-modal";
import {
  DEFAULT_CELL_FORMAT,
  VirtualPivotConditionalDialog,
  VirtualPivotFormatCellsDialog,
  applyCellFormatToConfig,
  cellFormatFromConfig,
  type CellFormatState
} from "@/components/reports/virtual-pivot-format-dialogs";
import { VirtualPivotDateFormatDialog } from "@/components/reports/virtual-pivot-date-format-dialog";
import {
  DEFAULT_PIVOT_DATE_FORMAT,
  applyDateFormatToConfig,
  applyDateFormatToRows,
  dateFormatStateFromConfig,
  type PivotDateFormatState
} from "@/lib/pivot-date-format";
import {
  applyClassicBranchBrandTemplate,
  applyFlatSalesDetailTemplate,
  flattenConfigZones
} from "@/lib/pivot-flat-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePivot } from "@/hooks/pivot/usePivot";
import { usePivotExport } from "@/hooks/pivot/usePivotExport";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import {
  detectSavedReportFormat,
  extractSavedDatasetFilters,
  DATASET_DISPLAY_PAGE_SIZE,
  DATASET_SCROLL_PAGE_SIZE,
  fetchAllReportBuilderDatasetPages,
  fetchReportBuilderDataset,
  fetchReportBuilderMetadata,
  fetchReportBuilderSavedReports,
  metadataToPivotFields,
  savePivotConfigReport,
  savedReportConfigToPivotConfig,
  type ReportBuilderDatasetRequest,
  type ReportBuilderDatasetResult
} from "@/lib/pivot-bridge";
import {
  defaultDatasetFilters,
  migrateLegacyReportBuilderConfigToWdrReport,
  type DatasetFiltersPayload
} from "@/lib/report-builder-wdr-migrate";
import {
  calculatedMeasuresToFields,
  collectExpandableRowKeys,
  countPivotExportRows,
  getChartWarnings,
  getExportWarnings,
  getFieldMembers,
  getPivotSliceTemplates,
  getPivotStrings,
  hasChartableData,
  pivotToChartData,
  shouldConfirmLargeExport,
  applyPivotSliceTemplate,
  summarizePivotFilter,
  type ConditionalFormatRule,
  type CustomizeCellFn,
  type PivotChartType,
  type PivotConfig
} from "@salec/pivot-engine";
import { api } from "@/lib/api";
import { resolveLayoutForm, type PivotLayoutForm } from "@/lib/pivot-layout-form";
import {
  DEFAULT_PIVOT_TABLE_STYLE_ID,
  WDR_DEFAULT_TABLE_STYLE_ID,
  loadPivotTableStyleId,
  persistPivotTableStyleId
} from "@/lib/pivot-table-styles";
import { STALE } from "@/lib/query-stale";

const PIVOT_DEMO_URL = process.env.NEXT_PUBLIC_PIVOT_DEMO_URL ?? "http://127.0.0.1:5174";

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  title
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`flex w-[58px] flex-col items-center justify-center gap-0.5 px-1 py-1 text-[9px] leading-tight transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40${active ? " bg-muted text-foreground" : " text-muted-foreground"}`}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
    >
      <span className="flex h-4 items-center [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      <span className="w-full truncate">{label}</span>
    </button>
  );
}

/** WebDataRocks / Arena «Настройки разметки» — pixel-close radio column. */
function OptionGroup({
  title,
  name,
  value,
  onChange,
  items
}: {
  title: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  items: readonly (readonly [string, string])[];
}) {
  return (
    <div className="min-w-0" style={{ verticalAlign: "top" }}>
      <div
        style={{
          color: "#999",
          fontSize: 14,
          textTransform: "uppercase",
          marginBottom: 25,
          fontFamily: "Arial, Helvetica, sans-serif",
          letterSpacing: 0
        }}
      >
        {title}
      </div>
      <ul className="m-0 list-none p-0">
        {items.map(([itemValue, label]) => {
          const checked = value === itemValue;
          return (
            <li key={itemValue} style={{ marginBottom: 12 }}>
              <div className="relative">
                <input
                  id={`${name}-${itemValue}`}
                  type="radio"
                  name={name}
                  checked={checked}
                  onChange={() => onChange(itemValue)}
                  className="peer absolute opacity-0"
                  style={{ width: 0, height: 0 }}
                />
                <label
                  htmlFor={`${name}-${itemValue}`}
                  className="relative inline-block cursor-pointer"
                  style={{
                    color: "#111",
                    fontSize: 14,
                    padding: "4px 0 4px 35px",
                    lineHeight: 1.2,
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: checked ? 700 : 400
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 block -translate-y-1/2 rounded-full bg-white"
                    style={{
                      width: 22,
                      height: 22,
                      border: "1px solid #d5d5d5"
                    }}
                  />
                  {checked ? (
                    <span
                      aria-hidden
                      className="absolute top-1/2 block -translate-y-1/2 rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        left: 5,
                        background: "#555"
                      }}
                    />
                  ) : null}
                  {label}
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Arena Universal Sales Report «Настройки разметки» radio labels. */
const GRAND_TOTAL_OPTIONS = [
  ["none", "Не показывать общий итог"],
  ["both", "Показать общий итог"],
  ["rows", "Показать только для рядов"],
  ["columns", "Показать только для столбцов"]
] as const;

const SUBTOTAL_OPTIONS = [
  ["none", "Не показывать промежуточный итог"],
  ["both", "Показать промежуточный итог"],
  ["rows", "Показать только промежуточный итог рядов"],
  ["columns", "Показать только промежуточный итог столбцов"]
] as const;

const LAYOUT_FORM_OPTIONS = [
  ["compact", "Компактная форма"],
  ["classic", "Классическая форма"],
  ["flat", "Табличная форма"]
] as const;

export function VirtualPivotReportBuilder() {
  const rb = getPivotStrings().reportBuilder;
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [filters, setFilters] = useState<DatasetFiltersPayload>(() => defaultDatasetFilters());
  const [datasetRows, setDatasetRows] = useState<Record<string, unknown>[]>([]);
  const [datasetMeta, setDatasetMeta] = useState<Pick<
    ReportBuilderDatasetResult,
    "truncated" | "totalRowCount" | "cap" | "hasMore" | "pageOffset" | "pageLimit"
  > | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingFullForExport, setIsLoadingFullForExport] = useState(false);
  /** Flat sliding window: ekrandagi blokning dataset dagi absolut offseti. */
  const [dataWindowOffset, setDataWindowOffset] = useState(0);
  const [activeSavedReportId, setActiveSavedReportId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [chartType, setChartType] = useState<PivotChartType>("bar");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [toolbarMenu, setToolbarMenu] = useState<"reports" | "export" | "format" | "tableStyle" | null>(null);
  const [tableStyleId, setTableStyleId] = useState(DEFAULT_PIVOT_TABLE_STYLE_ID);
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [loadingSavedReportId, setLoadingSavedReportId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldsInitialConfig, setFieldsInitialConfig] = useState<PivotConfig | null>(null);
  const [grandTotals, setGrandTotals] = useState<"none" | "both" | "rows" | "columns">("both");
  const [subtotals, setSubtotals] = useState<"none" | "both" | "rows" | "columns">("both");
  const [schema, setSchema] = useState<PivotLayoutForm>("flat");
  const [formatCellsOpen, setFormatCellsOpen] = useState(false);
  const [dateFormatOpen, setDateFormatOpen] = useState(false);
  const [dateFormat, setDateFormat] = useState<PivotDateFormatState>(DEFAULT_PIVOT_DATE_FORMAT);
  const [conditionalOpen, setConditionalOpen] = useState(false);
  const [cellFormat, setCellFormat] = useState<CellFormatState>(DEFAULT_CELL_FORMAT);
  const [draftConditionalRules, setDraftConditionalRules] = useState<ConditionalFormatRule[]>([]);
  const [editingFilterFieldId, setEditingFilterFieldId] = useState<string | null>(null);
  const pivotContainerRef = useRef<HTMLDivElement>(null);
  const pivotTableRef = useRef<PivotTableHandle>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const metaQ = useQuery({
    queryKey: ["report-builder-metadata", "v2-bonus-qty", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    refetchOnMount: "always",
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

  const pivotInputRows = useMemo(
    () => applyDateFormatToRows(datasetRows, pivotFields, dateFormat),
    [datasetRows, pivotFields, dateFormat]
  );

  const {
    config,
    pivotData,
    isComputing,
    computeError,
    clearComputeError,
    usingWorker,
    expandedRows,
    updateConfig,
    addField,
    removeField,
    reorderFields,
    setFlatColumnOrder,
    reorderValueFields,
    updateValueAggregation,
    setSortBy,
    setFilter,
    toggleRow,
    expandAll,
    collapseAll,
    resetConfig,
    hasData,
    drillOpen,
    drillRecords,
    drillCell,
    openDrillThrough,
    closeDrillThrough,
    addCalculatedPreset,
    addCalculatedMeasure,
    removeCalculatedMeasure,
    updateCalculatedMeasure,
    toggleColumnTotals,
    activeFilterCount
  } = usePivot(pivotInputRows, pivotFields, { suspendCompute: fieldsOpen });

  /** Бонусы (bonus_qty) — Ряды/legacy dan Значения ga ko‘chirish (flatda ustun tartibini buzmasin). */
  useEffect(() => {
    if (resolveLayoutForm(config.options) === "flat") return;
    if (!pivotFields.some((f) => f.id === "bonus_qty")) return;
    const legacy = "order_bonuses_display";
    const id = "bonus_qty";
    const inRows = config.rows.includes(id) || config.rows.includes(legacy);
    const inCols = config.columns.includes(id) || config.columns.includes(legacy);
    const legacyValue = config.values.some((v) => v.fieldId === legacy);
    const legacyFilter = config.reportFilters.includes(legacy);
    if (!inRows && !inCols && !legacyValue && !legacyFilter) return;

    const restValues = config.values.filter((v) => v.fieldId !== id && v.fieldId !== legacy);
    const hadBonus =
      inRows || inCols || legacyValue || config.values.some((v) => v.fieldId === id);
    updateConfig({
      rows: config.rows.filter((x) => x !== id && x !== legacy),
      columns: config.columns.filter((x) => x !== id && x !== legacy),
      reportFilters: config.reportFilters.filter((x) => x !== legacy),
      values: hadBonus
        ? [...restValues, { fieldId: id, aggregation: "SUM", label: "Бонусы" }]
        : restValues
    });
  }, [
    pivotFields,
    config.rows,
    config.columns,
    config.values,
    config.reportFilters,
    config.options,
    updateConfig
  ]);

  const pivotEngineWarnings = pivotData?.metadata?.warnings ?? [];
  const showLargeDatasetHint =
    pivotInputRows.length >= 5_000 && (isComputing || Boolean(pivotData));

  const { exportExcel, exportPdf, exportHtml, exportChartPng, exportCsv, isExporting, exportProgressLabel } =
    usePivotExport();

  const chartData = useMemo(
    () => (pivotData ? pivotToChartData(pivotData) : null),
    [pivotData]
  );

  const filterSummaries = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const f of config.filters) {
      map[f.fieldId] = summarizePivotFilter(f);
    }
    return map;
  }, [config.filters]);

  const customizeCell = useCallback<CustomizeCellFn>(
    ({ cell }) => {
      if (cell.columnKey === "__row_label__" || cell.isEmpty) return;
      return {
        className:
          cellFormat.align === "left"
            ? "pgAlignLeft"
            : cellFormat.align === "center"
              ? "pgAlignCenter"
              : "pgAlignRight"
      };
    },
    [cellFormat.align]
  );

  const editingFilterField = useMemo(
    () => (editingFilterFieldId ? pivotFields.find((f) => f.id === editingFilterFieldId) ?? null : null),
    [editingFilterFieldId, pivotFields]
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

  const handleExportExcel = useCallback(async () => {
    if (!pivotData) return;
    if (!confirmLargeExport()) return;

    let dataForExport = pivotData;

    if ((datasetMeta?.hasMore || dataWindowOffset > 0) && tenantSlug) {
      setIsLoadingFullForExport(true);
      setNotice({
        message: "Excel: загружаются все строки для полного отчёта…",
        tone: "success"
      });
      try {
        const payload: ReportBuilderDatasetRequest = {
          ...filters,
          rowFieldIds: config.rows,
          colFieldIds: config.columns
        };
        // Sliding window — ekrandagi blok to‘liq emas; Excel uchun 0-dan yig‘amiz
        const full = await fetchAllReportBuilderDatasetPages(tenantSlug, payload, [], {
          totalRowCount: datasetMeta?.totalRowCount ?? 0,
          cap: datasetMeta?.cap ?? 50_000,
          hasMore: true
        });
        // Ekran oynasini 50k bilan almashtirmaymiz — xotira uchun window saqlanadi

        const { buildFlatPivotDataAsync } = await import("@/lib/build-flat-pivot-data");
        const { PivotEngine } = await import("@salec/pivot-engine");
        const layout = resolveLayoutForm(config.options);
        dataForExport =
          layout === "flat"
            ? await buildFlatPivotDataAsync(full.rows, pivotFields, config)
            : new PivotEngine().compute(full.rows, pivotFields, config);
      } catch (err) {
        setNotice({ message: getUserFacingError(err), tone: "error" });
        return;
      } finally {
        setIsLoadingFullForExport(false);
      }
    }

    const exported = await exportExcel(dataForExport, {
      filename: `pivot-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      expandedRows,
      sheetName: "Pivot"
    });
    setNotice(
      exported
        ? {
            message: `Экспорт Excel готов — ${dataForExport.metadata.processedRows.toLocaleString("ru-RU")} строк.`,
            tone: "success"
          }
        : { message: "Не удалось экспортировать Excel.", tone: "error" }
    );
  }, [
    confirmLargeExport,
    config,
    dataWindowOffset,
    datasetMeta,
    exportExcel,
    filters,
    pivotData,
    expandedRows,
    pivotFields,
    tenantSlug
  ]);

  const handleExportPdf = useCallback(async () => {
    if (!confirmLargeExport()) return;
    const exported = await exportPdf(pivotData, {
      filename: `pivot-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Сводная таблица",
      expandedRows
    });
    setNotice(exported ? { message: "Экспорт PDF готов — файл скачан.", tone: "success" } : { message: "Не удалось экспортировать PDF.", tone: "error" });
  }, [confirmLargeExport, exportPdf, pivotData, expandedRows]);

  const handleExportHtml = useCallback(async () => {
    if (!confirmLargeExport()) return;
    const exported = await exportHtml(pivotData, {
      filename: `pivot-report-${new Date().toISOString().slice(0, 10)}.html`,
      title: "Сводная таблица",
      expandedRows
    });
    setNotice(exported ? { message: "Экспорт HTML готов — файл скачан.", tone: "success" } : { message: "Не удалось экспортировать HTML.", tone: "error" });
  }, [confirmLargeExport, exportHtml, pivotData, expandedRows]);

  const handleExportChartPng = useCallback(async () => {
    const exported = await exportChartPng(chartRef.current, {
      filename: `pivot-chart-${new Date().toISOString().slice(0, 10)}.png`
    });
    setNotice(exported ? { message: "Экспорт PNG готов — файл скачан.", tone: "success" } : { message: "Не удалось экспортировать PNG.", tone: "error" });
  }, [exportChartPng]);

  const handleExportCsv = useCallback(async () => {
    if (!confirmLargeExport()) return;
    const exported = await exportCsv(pivotData, {
      filename: `pivot-report-${new Date().toISOString().slice(0, 10)}.csv`,
      expandedRows
    });
    setNotice(
      exported
        ? { message: "Экспорт CSV готов — файл скачан.", tone: "success" }
        : { message: "Не удалось экспортировать CSV.", tone: "error" }
    );
  }, [confirmLargeExport, exportCsv, pivotData, expandedRows]);

  const handleCopySelection = useCallback(async () => {
    const ok = await pivotTableRef.current?.copySelection();
    if (ok) {
      setNotice({ message: "Выделение скопировано в буфер обмена.", tone: "success" });
    } else {
      setNotice({ message: "Выделите ячейки в таблице, затем нажмите «Копировать».", tone: "error" });
    }
  }, []);

  const handleLoadSavedReport = useCallback(
    async (savedId: number, savedConfig: unknown) => {
      setLoadingSavedReportId(savedId);
      try {
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
          setNotice({ message: rb.savedReportIncompatible, tone: "error" });
          return false;
        }
        updateConfig(pivotConfig);
        setDateFormat(dateFormatStateFromConfig(pivotConfig));
        setImportError(null);
        setActiveSavedReportId(savedId);

        if (tenantSlug) {
          const payload: ReportBuilderDatasetRequest = {
            ...(restoredFilters ?? filters),
            rowFieldIds: pivotConfig.rows,
            colFieldIds: pivotConfig.columns,
            pageLimit: DATASET_DISPLAY_PAGE_SIZE,
            pageOffset: 0
          };
          try {
            const result = await fetchReportBuilderDataset(tenantSlug, payload);
            setDatasetRows(result.rows);
            setDataWindowOffset(0);
            setDatasetMeta({
              truncated: result.truncated,
              totalRowCount: result.totalRowCount,
              cap: result.cap,
              hasMore: result.hasMore,
              pageOffset: result.pageOffset,
              pageLimit: result.pageLimit
            });
            setLoadError(null);
          } catch (err) {
            const message = getUserFacingError(err);
            setLoadError(message);
            setNotice({ message, tone: "error" });
            return false;
          }
        }
        return true;
      } finally {
        setLoadingSavedReportId(null);
      }
    },
    [filters, rb.savedReportIncompatible, tenantSlug, updateConfig]
  );

  const loadMut = useMutation({
    mutationFn: async () => {
      const payload: ReportBuilderDatasetRequest = {
        ...filters,
        rowFieldIds: config.rows,
        colFieldIds: config.columns,
        pageLimit: DATASET_DISPLAY_PAGE_SIZE,
        pageOffset: 0
      };
      return fetchReportBuilderDataset(tenantSlug!, payload);
    },
    onSuccess: (result) => {
      setDatasetRows(result.rows);
      setDataWindowOffset(0);
      setDatasetMeta({
        truncated: result.truncated,
        totalRowCount: result.totalRowCount,
        cap: result.cap,
        hasMore: result.hasMore,
        pageOffset: result.pageOffset,
        pageLimit: result.pageLimit
      });
      setLoadError(null);
    },
    onError: (err) => setLoadError(getUserFacingError(err))
  });

  const handleLoadData = useCallback(() => {
    if (!tenantSlug) return;
    loadMut.mutate();
  }, [tenantSlug, loadMut]);

  const handleLoadMoreRows = useCallback(async () => {
    if (!tenantSlug || !datasetMeta?.hasMore || isLoadingMore || loadMut.isPending) return;
    setIsLoadingMore(true);
    try {
      const layout = resolveLayoutForm(config.options);
      const nextOffset = dataWindowOffset + datasetRows.length;
      const payload: ReportBuilderDatasetRequest = {
        ...filters,
        rowFieldIds: config.rows,
        colFieldIds: config.columns,
        pageLimit: DATASET_SCROLL_PAGE_SIZE,
        pageOffset: nextOffset
      };
      const page = await fetchReportBuilderDataset(tenantSlug, payload);
      if (!page.rows.length) {
        setDatasetMeta((prev) => (prev ? { ...prev, hasMore: false } : prev));
        return;
      }

      if (layout === "flat") {
        // Sliding window: eski blokni tozalab, faqat yangi sahifani ko‘rsatish
        setDatasetRows(page.rows);
        setDataWindowOffset(page.pageOffset);
        pivotTableRef.current?.clearSelection();
        // Jadval tepasiga qaytarish (yangi blok)
        requestAnimationFrame(() => {
          const host = document.querySelector("[data-pivot-scroll]") as HTMLElement | null;
          if (host) host.scrollTop = 0;
        });
      } else {
        setDatasetRows((prev) => prev.concat(page.rows));
        // Klassik: 0 dan yig‘iladi
        setDataWindowOffset(0);
      }

      setDatasetMeta({
        truncated: page.truncated,
        totalRowCount: page.totalRowCount,
        cap: page.cap,
        hasMore: page.hasMore,
        pageOffset: page.pageOffset,
        pageLimit: page.pageLimit
      });
    } catch (err) {
      setNotice({ message: getUserFacingError(err), tone: "error" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    config.columns,
    config.options,
    config.rows,
    dataWindowOffset,
    datasetMeta?.hasMore,
    datasetRows.length,
    filters,
    isLoadingMore,
    loadMut.isPending,
    tenantSlug
  ]);

  const saveMut = useMutation({
    mutationFn: async (name: string) => {
      return savePivotConfigReport(tenantSlug!, name.trim(), config, filters);
    },
    onSuccess: (saved) => {
      setSaveError(null);
      setSaveName("");
      setActiveSavedReportId(saved.id);
      setSaveDialogOpen(false);
      setNotice({ message: `Отчёт «${saved.name}» сохранён.`, tone: "success" });
      void savedQ.refetch();
    },
    onError: (err) => {
      const message = getUserFacingError(err);
      setSaveError(message);
      setNotice({ message, tone: "error" });
    }
  });

  const drillFields = useMemo(
    () => [...pivotFields, ...calculatedMeasuresToFields(config.calculatedMeasures ?? [])],
    [pivotFields, config.calculatedMeasures]
  );

  const isWorkspaceExpanded = isFullscreen || workspaceExpanded;

  const currentLayoutForm = useMemo(() => resolveLayoutForm(config.options), [config.options]);

  const expandableRowKeys = useMemo(
    () => (pivotData?.rows?.length ? collectExpandableRowKeys(pivotData.rows) : []),
    [pivotData]
  );

  const hierarchyExpanded =
    expandableRowKeys.length > 0 && expandableRowKeys.some((key) => expandedRows.has(key));

  const toggleHierarchy = useCallback(() => {
    if (hierarchyExpanded) {
      collapseAll();
      return;
    }
    if (expandableRowKeys.length > 2_000) {
      setNotice({
        message:
          "Слишком много групп для полного разворота. Откройте нужные уровни кнопкой «+» в таблице.",
        tone: "error"
      });
      return;
    }
    expandAll();
  }, [collapseAll, expandAll, expandableRowKeys.length, hierarchyExpanded]);

  const handleEnterFullscreen = useCallback(() => {
    if (isWorkspaceExpanded) return;
    const el = pivotContainerRef.current;
    if (!el) return;
    const request =
      el.requestFullscreen?.bind(el) ??
      (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(el);
    if (!request) {
      setWorkspaceExpanded(true);
      return;
    }
    void request().catch(() => setWorkspaceExpanded(true));
  }, [isWorkspaceExpanded]);

  const handleExitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      const exit =
        document.exitFullscreen?.bind(document) ??
        (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen?.bind(document);
      if (exit) void exit();
      return;
    }
    if (workspaceExpanded) setWorkspaceExpanded(false);
  }, [workspaceExpanded]);

  const handleToggleFullscreen = useCallback(() => {
    if (isWorkspaceExpanded) handleExitFullscreen();
    else handleEnterFullscreen();
  }, [handleEnterFullscreen, handleExitFullscreen, isWorkspaceExpanded]);

  const openOptions = useCallback(() => {
    const layout = resolveLayoutForm(config.options);
    setGrandTotals(
      !config.options.showGrandTotal && !config.options.showColumnTotals
        ? "none"
        : config.options.showGrandTotal && config.options.showColumnTotals
          ? "both"
          : config.options.showColumnTotals && !config.options.showGrandTotal
            ? "columns"
            : "rows"
    );
    setSubtotals(
      !config.options.showSubtotals
        ? "none"
        : "both"
    );
    setSchema(layout);
    setOptionsOpen(true);
  }, [config]);

  const applyOptions = useCallback(() => {
    const nextLayout = schema;
    let next: typeof config = {
      ...config,
      options: {
        ...config.options,
        showGrandTotal: grandTotals === "both" || grandTotals === "rows",
        showColumnTotals: grandTotals === "both" || grandTotals === "columns",
        showSubtotals: subtotals === "both" || subtotals === "rows",
        layoutForm: nextLayout,
        compactMode: nextLayout === "compact"
      }
    };
    if (nextLayout === "flat") {
      next = flattenConfigZones(next);
    }
    updateConfig(next);
    if (nextLayout === "flat") collapseAll();
    if (nextLayout === "classic") {
      window.setTimeout(() => {
        if (expandableRowKeys.length <= 2_000) expandAll();
      }, 0);
    }
    setOptionsOpen(false);
  }, [collapseAll, config, expandAll, expandableRowKeys.length, grandTotals, schema, subtotals, updateConfig]);

  const openFields = useCallback(() => {
    setFieldsInitialConfig(config);
    setFieldsOpen(true);
  }, [config]);

  const cancelFields = useCallback(() => {
    if (fieldsInitialConfig) updateConfig(fieldsInitialConfig);
    setFieldsOpen(false);
  }, [fieldsInitialConfig, updateConfig]);

  const applyFields = useCallback(() => {
    setFieldsOpen(false);
  }, []);

  useEffect(() => {
    const onChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) setWorkspaceExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const id = loadPivotTableStyleId();
    setTableStyleId(id);
    persistPivotTableStyleId(id);
  }, []);

  const applyTableStyle = useCallback((id: string) => {
    setTableStyleId(id);
    persistPivotTableStyleId(id);
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 p-3 md:p-4">
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

      {datasetMeta?.truncated ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          {rb.datasetTruncated(
            datasetMeta.cap.toLocaleString("ru-RU"),
            datasetMeta.totalRowCount.toLocaleString("ru-RU")
          )}
        </div>
      ) : null}

      {datasetMeta && datasetRows.length > 0 ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          На экране: {datasetRows.length.toLocaleString("ru-RU")}
          {datasetMeta.totalRowCount > 0
            ? ` (позиции ${(dataWindowOffset + 1).toLocaleString("ru-RU")}–${(
                dataWindowOffset + datasetRows.length
              ).toLocaleString("ru-RU")} из ${Math.min(
                datasetMeta.totalRowCount,
                datasetMeta.cap
              ).toLocaleString("ru-RU")})`
            : null}
          {datasetMeta.hasMore
            ? currentLayoutForm === "flat"
              ? " — прокрутите вниз: старый блок очистится, загрузятся следующие 500 строк. Excel — полный набор."
              : " — прокрутите вниз, чтобы подгрузить следующие 500 строк. Excel выгрузит полный набор."
            : " — все доступные строки загружены."}
          {isLoadingMore || isLoadingFullForExport ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isLoadingFullForExport ? "полная загрузка…" : "ещё строки…"}
            </span>
          ) : null}
        </div>
      ) : null}

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

      <div
        ref={pivotContainerRef}
        className={`flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-md border border-border bg-card p-3${isWorkspaceExpanded ? " fixed inset-0 z-50 h-screen w-screen overflow-auto rounded-none border-0 bg-background" : ""}`}
      >
        <div className="flex min-h-14 flex-wrap items-stretch justify-between gap-2 border-b border-border bg-background px-1 pb-1">
          <div className="flex items-stretch">
            <div className="relative flex">
              <ToolbarButton icon={<FolderOpen />} label="Отчёты" onClick={() => setReportsDialogOpen(true)} />
              <ToolbarButton icon={<Save />} label="Сохр. как" onClick={() => { setSaveError(null); setSaveName(`Pivot ${new Date().toLocaleDateString("ru-RU")}`); setSaveDialogOpen(true); }} disabled={!config.values.length || saveMut.isPending} />
              <ToolbarButton icon={<Download />} label="Экспорт" onClick={() => setToolbarMenu(toolbarMenu === "export" ? null : "export")} disabled={!hasData || isComputing || isLoadingFullForExport} />
              <ToolbarButton
                icon={<Copy />}
                label="Копировать"
                title="Копировать"
                onClick={() => void handleCopySelection()}
                disabled={!hasData || isComputing || viewMode !== "table"}
              />
              <ToolbarButton
                icon={hierarchyExpanded ? <Minimize2 /> : <Maximize2 />}
                label={hierarchyExpanded ? "Сверн." : "Развер."}
                onClick={toggleHierarchy}
                disabled={isComputing || !hasData || expandableRowKeys.length === 0 || currentLayoutForm === "flat"}
                active={hierarchyExpanded}
              />
              {toolbarMenu === "export" ? (
                <div className="absolute left-24 top-full z-30 mt-1 w-44 rounded-sm border border-border bg-popover p-1 text-xs shadow-lg">
                  <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => { void handleExportExcel(); setToolbarMenu(null); }}>{getPivotStrings().toolbar.excel}</button>
                  <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => { void handleExportCsv(); setToolbarMenu(null); }}>{getPivotStrings().toolbar.csv}</button>
                  <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => { void handleExportPdf(); setToolbarMenu(null); }}>{getPivotStrings().toolbar.pdf}</button>
                  <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => { void handleExportHtml(); setToolbarMenu(null); }}>{getPivotStrings().toolbar.html}</button>
                  {viewMode === "chart" ? <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => { void handleExportChartPng(); setToolbarMenu(null); }}>PNG</button> : null}
                </div>
              ) : null}
            </div>
            <span className="ml-2 self-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {currentLayoutForm === "flat" ? "Табличная" : currentLayoutForm === "compact" ? "Компактная" : "Классическая"}
            </span>
            <div className="relative ml-1 flex items-stretch">
              <ToolbarButton
                icon={<TableStyleToolbarIcon />}
                label="Стиль"
                title="Стили таблицы"
                active={toolbarMenu === "tableStyle"}
                onClick={() => setToolbarMenu(toolbarMenu === "tableStyle" ? null : "tableStyle")}
              />
              <TableStyleGallery
                open={toolbarMenu === "tableStyle"}
                selectedId={tableStyleId}
                onSelect={(id) => applyTableStyle(id)}
                onClear={() => applyTableStyle(WDR_DEFAULT_TABLE_STYLE_ID)}
                onCreateStub={() => setNotice({ message: "Создание стиля таблицы — скоро.", tone: "success" })}
                onClose={() => setToolbarMenu(null)}
              />
            </div>
          </div>
          <div className="flex items-stretch">
            <div className="relative flex">
              <ToolbarButton
                icon={<CalendarCog />}
                label="Формат даты"
                title="Формат даты"
                onClick={() => setDateFormatOpen(true)}
              />
              <ToolbarButton icon={<SlidersHorizontal />} label="Формат" onClick={() => setToolbarMenu(toolbarMenu === "format" ? null : "format")} />
              <ToolbarButton icon={<Settings2 />} label="Опции" onClick={openOptions} />
              <ToolbarButton icon={<TableProperties />} label="Поля" onClick={openFields} />
              <ToolbarButton
                icon={isWorkspaceExpanded ? <Minimize2 /> : <Maximize2 />}
                label={isWorkspaceExpanded ? "Сверн." : "На весь..."}
                onClick={handleToggleFullscreen}
                active={isWorkspaceExpanded}
              />
              {toolbarMenu === "format" ? (
                <div className="absolute right-20 top-full z-30 mt-1 w-52 rounded-sm border border-border bg-popover p-1 text-xs shadow-lg">
                  <button
                    className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                    onClick={() => {
                      setCellFormat({ ...DEFAULT_CELL_FORMAT, ...cellFormatFromConfig(config) });
                      setFormatCellsOpen(true);
                      setToolbarMenu(null);
                    }}
                  >
                    Формат ячеек…
                  </button>
                  <button
                    className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                    onClick={() => {
                      setDraftConditionalRules([...(config.options.conditionalFormats ?? [])]);
                      setConditionalOpen(true);
                      setToolbarMenu(null);
                    }}
                  >
                    Условное форматирование…
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => { setViewMode("table"); setToolbarMenu(null); }}>Таблица</button>
                  <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => { setViewMode("chart"); setToolbarMenu(null); }}>Диаграмма</button>
                  <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => { toggleColumnTotals(); setToolbarMenu(null); }}>Итоги по столбцам</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

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
                if (template.id === "flat_sales_detail") {
                  updateConfig(applyFlatSalesDetailTemplate(pivotFields, config));
                  collapseAll();
                  return;
                }
                if (template.id === "classic_branch_brand") {
                  updateConfig(applyClassicBranchBrandTemplate(pivotFields, config));
                  window.setTimeout(() => {
                    if (expandableRowKeys.length <= 2_000) expandAll();
                  }, 0);
                  return;
                }
                const next = applyPivotSliceTemplate(template.id, pivotFields, config);
                if (next) {
                  updateConfig(next);
                  if (next.options.layoutForm === "classic") {
                    window.setTimeout(() => {
                      if (expandableRowKeys.length <= 2_000) expandAll();
                    }, 0);
                  }
                }
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
            onClick={() => {
              setSaveError(null);
              setSaveName(`Pivot ${new Date().toLocaleDateString("ru-RU")}`);
              setSaveDialogOpen(true);
            }}
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

        {notice ? (
          <div className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${notice.tone === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
            <span>{notice.message}</span>
            <button type="button" className="ml-3 underline" onClick={() => setNotice(null)}>Закрыть</button>
          </div>
        ) : null}

        {computeError ? (
          <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span>{computeError}</span>
            <button type="button" className="ml-3 underline" onClick={() => clearComputeError()}>
              Закрыть
            </button>
          </div>
        ) : null}

        {pivotEngineWarnings.length > 0 ? (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            {pivotEngineWarnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        ) : null}

        {showLargeDatasetHint ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {rb.largeDatasetHint(pivotInputRows.length.toLocaleString("ru-RU"))}
          </div>
        ) : null}

        {(isComputing || usingWorker) && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isComputing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>
              {isComputing ? rb.computing : null}
              {usingWorker ? rb.workerActive : null}
              {isComputing && pivotInputRows.length > 0
                ? ` (${pivotInputRows.length.toLocaleString("ru-RU")} строк)`
                : null}
            </span>
          </p>
        )}

        {metaQ.isLoading ? (
          <p className="text-sm text-muted-foreground">{rb.loadingMetadata}</p>
        ) : null}

        {loadError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        )}
        {importError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {importError}
          </div>
        )}

        {!config.values.length && currentLayoutForm !== "flat" && (
          <p className="text-sm text-muted-foreground">
            {rb.dragMetricHint}
          </p>
        )}
        {currentLayoutForm === "flat" && !hasData && (
          <p className="text-sm text-muted-foreground">
            Табличная форма: откройте «Поля», отметьте колонки (или шаблон «Плоская (детальный)»), затем «Загрузить данные».
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
            <div
              className={
                isWorkspaceExpanded
                  ? "flex min-h-0 min-w-0 flex-1 flex-col space-y-0"
                  : "min-w-0 space-y-0"
              }
            >
              {config.reportFilters.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-t-md border border-b-0 border-border bg-muted/40 px-2.5 py-2 text-xs text-foreground">
                  <span className="mr-1 font-medium text-muted-foreground">
                    {getPivotStrings().filters.reportFiltersLabel ?? "Фильтры отчета"}:
                  </span>
                  {config.reportFilters.map((id) => {
                    const summary = filterSummaries[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs shadow-sm hover:bg-muted/60",
                          summary && "border-primary/40 bg-primary/5 text-foreground"
                        )}
                        onClick={() => setEditingFilterFieldId(id)}
                        title={summary ? `Фильтр: ${summary}` : "Настроить фильтр"}
                      >
                        <span className="font-medium">
                          {pivotFields.find((f) => f.id === id)?.label ?? id}
                        </span>
                        <span className={cn("text-[10px]", summary ? "text-primary" : "text-muted-foreground")}>
                          ▾
                        </span>
                        {summary ? (
                          <span className="max-w-[7rem] truncate text-[10px] text-primary">{summary}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  {activeFilterCount > 0 ? (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {typeof getPivotStrings().filters.activeFiltersCount === "function"
                        ? getPivotStrings().filters.activeFiltersCount(activeFilterCount)
                        : `Активных: ${activeFilterCount}`}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <PivotTable
                ref={pivotTableRef}
                data={pivotData}
                config={config}
                expandedRows={expandedRows}
                onToggleRow={toggleRow}
                onSort={setSortBy}
                onCellDoubleClick={
                  config.options.drillThrough === true ? openDrillThrough : undefined
                }
                fields={drillFields}
                rawData={pivotInputRows}
                onSetFilter={setFilter}
                onReorderRowFields={(ids) => reorderFields("rows", ids)}
                onReorderColumnFields={(ids) => reorderFields("columns", ids)}
                onReorderFlatColumns={setFlatColumnOrder}
                onReorderValueFields={reorderValueFields}
                onNearEnd={() => {
                  void handleLoadMoreRows();
                }}
                customizeCell={customizeCell}
                tableStyleId={tableStyleId}
                className={
                  isWorkspaceExpanded
                    ? "min-h-0 min-w-0 w-full flex-1 max-h-none h-full"
                    : "min-w-0 w-full max-h-[calc(100vh-20rem)]"
                }
              />
            </div>
          ))}

        <PivotDrillThrough
          open={drillOpen}
          records={drillRecords}
          fields={drillFields}
          cellContext={drillCell?.drillContext}
          onClose={closeDrillThrough}
        />

        <Dialog open={reportsDialogOpen} onOpenChange={setReportsDialogOpen}>
          <DialogContent className="max-h-[80vh] w-[620px] max-w-[calc(100%-2rem)] overflow-y-auto rounded-sm border border-[#d4d4d4] bg-white shadow-xl">
            <DialogHeader>
              <DialogTitle>Отчёты и шаблоны среза</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Загрузите сохранённую конфигурацию или примените готовый шаблон к текущей таблице.
              </p>
            </DialogHeader>
            <section className="space-y-2">
              <p className="text-xs font-medium">Шаблоны среза</p>
              <div className="flex flex-wrap gap-2">
                {getPivotSliceTemplates().map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!pivotFields.length}
                    title={template.description}
                    onClick={() => {
                      const next = applyPivotSliceTemplate(template.id, pivotFields, config);
                      if (!next) return;
                      updateConfig(next);
                      setActiveSavedReportId(null);
                      setNotice({ message: `Применён шаблон «${template.label}».`, tone: "success" });
                      setReportsDialogOpen(false);
                    }}
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
            </section>
            <section className="space-y-2 border-t pt-4">
              <p className="text-xs font-medium">Сохранённые отчёты</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetConfig();
                  setActiveSavedReportId(null);
                  setNotice({ message: "Загружена конфигурация по умолчанию.", tone: "success" });
                  setReportsDialogOpen(false);
                }}
              >
                По умолчанию
              </Button>
              {savedQ.isLoading ? <p className="text-xs text-muted-foreground">Загрузка отчётов…</p> : null}
              {!savedQ.isLoading && !savedQ.data?.length ? (
                <p className="text-xs text-muted-foreground">Сохранённых отчётов пока нет.</p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {(savedQ.data ?? []).map((report) => (
                  <Button
                    key={report.id}
                    type="button"
                    variant={activeSavedReportId === report.id ? "default" : "outline"}
                    className="justify-start truncate"
                    disabled={loadingSavedReportId === report.id}
                    onClick={() => {
                      void handleLoadSavedReport(report.id, report.config).then((loaded) => {
                        if (!loaded) return;
                        setNotice({ message: `Загружен отчёт «${report.name}».`, tone: "success" });
                        setReportsDialogOpen(false);
                      });
                    }}
                  >
                    {loadingSavedReportId === report.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    {report.name}
                  </Button>
                ))}
              </div>
            </section>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReportsDialogOpen(false)}>Закрыть</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent className="w-[420px] max-w-[calc(100%-2rem)] rounded-sm border border-[#d4d4d4] bg-white shadow-xl">
            <DialogHeader>
              <DialogTitle>Сохранить как</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Будут сохранены поля, фильтры, группировки и настройки текущей сводной таблицы.
              </p>
            </DialogHeader>
            <Input
              autoFocus
              value={saveName}
              placeholder="Например: Продажи по агентам"
              onChange={(event) => setSaveName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && saveName.trim()) saveMut.mutate(saveName);
              }}
            />
            {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>Отмена</Button>
              <Button type="button" disabled={!saveName.trim() || saveMut.isPending} onClick={() => saveMut.mutate(saveName)}>
                {saveMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
          <DialogContent
            showCloseButton={false}
            overlayClassName="bg-black/25"
            className={cn(
              "gap-0 overflow-visible rounded-none border border-[#d5d5d5] bg-white p-0 shadow-[0_4px_16px_rgba(0,0,0,0.25)]",
              "!inset-0 !left-0 !right-0 !top-0 !bottom-0 !m-auto !h-fit",
              "!translate-x-0 !translate-y-0 !transform-none",
              "data-open:!animate-none data-closed:!animate-none !duration-0 !ring-0",
              "w-[620px] max-w-[calc(100%-2rem)] sm:max-w-[620px]"
            )}
            style={{
              transform: "none",
              padding: "22px 28px 28px",
              boxSizing: "border-box",
              fontFamily: "Arial, Helvetica, sans-serif"
            }}
          >
            {/* Header — Arena original */}
            <div className="relative" style={{ minHeight: 40, marginBottom: 28 }}>
              <DialogTitle
                className="m-0 block p-0"
                style={{
                  color: "#111",
                  fontSize: 20,
                  fontWeight: 700,
                  padding: "6px 0",
                  lineHeight: 1.2,
                  paddingRight: 210
                }}
              >
                Настройки разметки
              </DialogTitle>
              <div
                className="absolute right-0 top-0 flex"
                style={{ fontSize: 0 }}
              >
                <button
                  type="button"
                  onClick={applyOptions}
                  className="inline-block cursor-pointer text-center uppercase outline-none"
                  style={{
                    height: 38,
                    minWidth: 90,
                    marginRight: 20,
                    padding: "10px 12px",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    color: "#fff",
                    background: "#555",
                    border: "none",
                    borderRadius: 4,
                    fontFamily: "Arial, Helvetica, sans-serif"
                  }}
                >
                  Применить
                </button>
                <button
                  type="button"
                  onClick={() => setOptionsOpen(false)}
                  className="inline-block cursor-pointer text-center uppercase outline-none"
                  style={{
                    height: 38,
                    minWidth: 90,
                    padding: "10px 12px",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    color: "#555",
                    background: "#DBDBDB",
                    border: "none",
                    borderRadius: 4,
                    fontFamily: "Arial, Helvetica, sans-serif"
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>

            {/* Body — Arena original: 2 ustun + Разметки chap pastda */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "auto auto",
                columnGap: 40,
                rowGap: 36,
                fontSize: 14
              }}
            >
              <div style={{ gridColumn: 1, gridRow: 1 }}>
                <OptionGroup
                  title="Общий итог"
                  name="grand-totals"
                  value={grandTotals}
                  onChange={(v) => setGrandTotals(v as typeof grandTotals)}
                  items={GRAND_TOTAL_OPTIONS}
                />
              </div>
              <div style={{ gridColumn: 2, gridRow: 1 }}>
                <OptionGroup
                  title="Промежуточный итог"
                  name="subtotals"
                  value={subtotals}
                  onChange={(v) => setSubtotals(v as typeof subtotals)}
                  items={SUBTOTAL_OPTIONS}
                />
              </div>
              <div style={{ gridColumn: 1, gridRow: 2 }}>
                <OptionGroup
                  title="Разметки"
                  name="schema"
                  value={schema}
                  onChange={(v) => setSchema(v as PivotLayoutForm)}
                  items={LAYOUT_FORM_OPTIONS}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                valuesPosition: layout.position,
                valuesAxisIndex: layout.valuesAxisIndex
              }
            });
            if (layout.position === "rows") {
              window.setTimeout(() => expandAll(), 0);
            }
          }}
          onSetFlatColumnOrder={setFlatColumnOrder}
          onConfigureFilter={(fieldId) => {
            setEditingFilterFieldId(fieldId);
          }}
          filterSummaries={filterSummaries}
          onApply={applyFields}
          onCancel={cancelFields}
        />

        <VirtualPivotFormatCellsDialog
          open={formatCellsOpen}
          onOpenChange={setFormatCellsOpen}
          initial={cellFormat}
          valueFields={config.values.map((v) => ({
            id: v.fieldId,
            label:
              config.calculatedMeasures?.find((m) => m.id === v.fieldId)?.label ??
              pivotFields.find((f) => f.id === v.fieldId)?.label ??
              v.label ??
              v.fieldId
          }))}
          onApply={(state) => {
            setCellFormat(state);
            updateConfig(applyCellFormatToConfig(config, state));
            setFormatCellsOpen(false);
          }}
        />

        <VirtualPivotDateFormatDialog
          open={dateFormatOpen}
          onOpenChange={setDateFormatOpen}
          initial={dateFormat}
          onApply={(state) => {
            setDateFormat(state);
            updateConfig(applyDateFormatToConfig(config, pivotFields, state));
          }}
        />

        <VirtualPivotConditionalDialog
          open={conditionalOpen}
          onOpenChange={setConditionalOpen}
          rules={draftConditionalRules}
          onChange={setDraftConditionalRules}
          valueFields={config.values.map((v) => ({
            id: v.fieldId,
            label:
              config.calculatedMeasures?.find((m) => m.id === v.fieldId)?.label ??
              pivotFields.find((f) => f.id === v.fieldId)?.label ??
              v.label ??
              v.fieldId
          }))}
          onApply={() => {
            updateConfig({
              options: { ...config.options, conditionalFormats: draftConditionalRules }
            });
            setConditionalOpen(false);
          }}
        />

        {editingFilterField ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"
            role="presentation"
            onClick={() => setEditingFilterFieldId(null)}
          >
            <div
              className="relative max-h-[min(90vh,640px)] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <FilterEditor
                field={editingFilterField}
                members={getFieldMembers(pivotInputRows, editingFilterField.id)}
                allFields={pivotFields}
                filter={config.filters.find((f) => f.fieldId === editingFilterField.id)}
                onApply={(filter) => {
                  setFilter(filter, editingFilterField.id);
                  setEditingFilterFieldId(null);
                }}
                onClose={() => setEditingFilterFieldId(null)}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
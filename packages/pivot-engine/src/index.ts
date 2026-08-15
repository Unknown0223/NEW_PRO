// Types
export type * from "./types/index.js";
export type { ConditionalFormatRule, ConditionalFormatRuleType, CalculatedMeasure, PivotCellDrillContext, CustomizeCellContext, CustomizeCellFn, CustomizeCellStyle, PivotLayoutForm, PivotTableSizes, PivotValuesPosition } from "./types/pivot.types.js";
export type * from "./types/schema.types.js";

// Core (Phase A + B)
export {
  Aggregator,
  CubeBuilder,
  ROOT_COL_KEY,
  CubeStore,
  hashAggregationConfig,
  hashFullConfig,
  hashPivotData,
  isAppendOnlyDataUpdate,
  isSortOnlyChange,
  type CubeCacheEntry,
  FilterEngine,
  DataTransformer,
  SortEngine,
  PivotEngine,
  DEFAULT_PIVOT_CONFIG,
  DEFAULT_PIVOT_OPTIONS
} from "./core/index.js";

// Utils (Phase A)
export {
  formatValue,
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDate,
  formatUzNumber,
  collectCurrencyCodesFromPivot,
  shouldShowCurrencySuffix,
  groupBy,
  splitGroupKey,
  lastGroupKeyPart,
  ALL_GROUP_KEY,
  GROUP_KEY_SEPARATOR,
  getFieldMembers,
  collectExpandableRowKeys,
  flattenPivotDisplayRows,
  getConditionalFormatStyle,
  getDrillThroughRecords,
  resolveRowGroupKey,
  compileFormula,
  evaluateFormula,
  applyCalculatedMeasures,
  calculatedMeasuresToFields,
  CALCULATED_MEASURE_PRESETS,
  getCalculatedMeasurePresets,
  RETROBONUS_TIER_PRESETS,
  summarizePivotFilter,
  getPivotSliceTemplates,
  applyPivotSliceTemplate,
  createDefaultPivotConfig,
  isEmptyPivotConfig,
  resolvePivotConfig,
  mergeCellStyles,
  resolveCustomizeCellStyle,
  resolveLayoutForm,
  withLayoutForm,
  hasFlatSlice,
  buildFlatPivotData,
  getFlatColumnFieldIds,
  getActiveSliceFilters,
  resolvePivotValueLabel,
  hydratePivotValueLabels,
  PIVOT_VALUES_AXIS_ID,
  resolveValuesPosition,
  valuesOnRows,
  isWdrMeasuresFieldId,
  type FlatPivotRowItem,
  type ConditionalFormatStyle,
  type MergedCellStyle,
  type DrillThroughCellContext,
  type GroupByOptions,
  type PivotSliceTemplate
} from "./utils/index.js";
export { resolveRowAxisHeaderLabel } from "./utils/rowAxisHeader.js";

// Export (Phase 3)
export {
  buildHeaderMatrix,
  buildPivotWorkbook,
  buildPivotWorksheet,
  exportPivotToExcel,
  pivotDataToAoA,
  countPdfExportRows,
  exportPivotToPdf,
  pivotDataToPdfTable,
  exportPivotToHtml,
  pivotDataToHtml,
  exportPivotToCsv,
  type ExportExcelOptions,
  type ExportPdfOptions,
  type ExportHtmlOptions,
  type ExportCsvOptions,
  type PivotPdfTable,
  exportRawRecordsToCsv,
  exportRawRecordsToExcel,
  type ExportRawRecordsOptions,
  type RawRecordColumn,
  EXPORT_CHUNK_SIZE,
  EXPORT_LARGE_DATASET_THRESHOLD,
  countPivotExportRows,
  formatExportProgressLabel,
  getExportWarnings,
  shouldConfirmLargeExport,
  yieldToMain,
  type ExportProgress,
  type ExportProgressPhase,
  type ExportWarningOptions
} from "./export/index.js";

// Chart (Phase 3)
export {
  pivotToChartData,
  hasChartableData,
  getChartWarnings,
  pivotChartDataToRechartsRows,
  exportChartElementToPng,
  resolveChartExportFilename,
  CHART_DEFAULT_MAX_CATEGORIES,
  CHART_LARGE_DATASET_THRESHOLD,
  type ChartSeries,
  type PivotChartData,
  type PivotChartMeta,
  type PivotChartType,
  type ExportChartPngOptions
} from "./chart/index.js";

// SALEC adapters
export {
  salecFieldsToPivotFields,
  salecWdrMeasuresToPivotFields,
  salecFieldsToDatasetSchema,
  normalizeSalecDatasetRows,
  mapWdrAggregation,
  wdrSliceToPivotConfig,
  wdrReportToPivotConfig,
  isWdrSavedReportConfig,
  detectSavedReportFormat,
  type SalecReportBuilderField,
  type SalecReportBuilderMetric,
  type WdrSliceJson,
  type WdrSavedReport
} from "./adapters/index.js";

// Worker (Phase 4)
export {
  createPivotWorkerClient,
  handlePivotWorkerRequest,
  DEFAULT_WORKER_THRESHOLD,
  WORKER_TARGET_ROW_COUNT,
  type PivotWorkerClient,
  type PivotWorkerClientOptions,
  type PivotWorkerRequest,
  type PivotWorkerResponse
} from "./worker/index.js";

// i18n
export {
  getPivotLocale,
  setPivotLocale,
  getPivotStrings,
  getAggregationLabel,
  type PivotLocale,
  type PivotStrings,
  type CalculatedMeasurePreset
} from "./i18n/index.js";

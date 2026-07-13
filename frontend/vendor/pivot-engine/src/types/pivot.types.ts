// ============================================
// ASOSIY TIPLAR
// ============================================

export type AggregationType =
  | "SUM"
  | "COUNT"
  | "AVG"
  | "MIN"
  | "MAX"
  | "COUNT_DISTINCT"
  | "PERCENT_OF_TOTAL"
  | "PERCENT_OF_ROW"
  | "PERCENT_OF_COLUMN"
  | "RUNNING_TOTAL"
  | "PRODUCT"
  | "INDEX"
  | "DIFFERENCE"
  | "CUSTOM";

export type DataType = "string" | "number" | "date" | "boolean" | "currency";

export interface PivotField {
  id: string;
  label: string;
  dataType: DataType;
  format?: FieldFormat;
}

export interface FieldFormat {
  type: "number" | "currency" | "percent" | "date";
  currency?: "UZS" | "USD" | "EUR";
  decimals?: number;
  dateFormat?: string;
}

export interface PivotValue {
  fieldId: string;
  label?: string;
  aggregation: AggregationType;
  format?: FieldFormat;
  customAggregator?: (values: number[]) => number;
}

/** Hisoblangan metrika — xavfsiz formula AST orqali (eval yo'q). */
export interface CalculatedMeasure {
  id: string;
  label: string;
  formula: string;
  format?: FieldFormat;
}

export interface PivotConfig {
  rows: string[];
  columns: string[];
  values: PivotValue[];
  /** Hisoblangan metrikalar (formula maydonlari) */
  calculatedMeasures?: CalculatedMeasure[];
  /** Hisobot darajasidagi filtr zonasi (WDR `reportFilters`) */
  reportFilters: string[];
  /** Maydon bo'yicha filtrlar (reportFilters va qator/ustun ierarxiyalari) */
  filters: PivotFilter[];
  options: PivotOptions;
}

export interface PivotFilter {
  fieldId: string;
  type: "include" | "exclude" | "range" | "date_range" | "top_n" | "bottom_n";
  values?: (string | number)[];
  range?: { min?: number; max?: number };
  dateRange?: { from?: Date; to?: Date };
  /** top_n / bottom_n uchun N qiymat */
  topN?: number;
  /** top_n / bottom_n uchun metrika maydoni (default: qatorlar soni) */
  measureFieldId?: string;
}

export type ConditionalFormatRuleType =
  | "negative"
  | "gt"
  | "lt"
  | "eq"
  | "gte"
  | "lte";

export interface ConditionalFormatRule {
  id?: string;
  /** Metrika maydoni; berilmasa barcha qiymat kataklariga */
  fieldId?: string;
  type: ConditionalFormatRuleType;
  threshold?: number;
  backgroundColor?: string;
  textColor?: string;
}

export interface PivotTableSizes {
  /** Default qator balandligi (px) */
  defaultRowHeight?: number;
  /** Default ustun kengligi (px) */
  defaultColumnWidth?: number;
  /** Ustun kaliti → kenglik (px) */
  columnWidths?: Record<string, number>;
}

export interface PivotOptions {
  showSubtotals: boolean;
  showGrandTotal: boolean;
  showColumnTotals: boolean;
  compactMode: boolean;
  sortBy?: { fieldId: string; direction: "asc" | "desc" };
  drillDown: boolean;
  maxRows?: number;
  conditionalFormats?: ConditionalFormatRule[];
  /** Jadval o'lchamlari (WDR Table Sizes ekvivalenti) */
  tableSizes?: PivotTableSizes;
}

export interface CustomizeCellStyle {
  backgroundColor?: string;
  color?: string;
  fontWeight?: string | number;
  className?: string;
  width?: number | string;
  minWidth?: number | string;
  height?: number | string;
}

export interface CustomizeCellContext {
  cell: PivotCell;
  config: PivotConfig;
  rowKey?: string;
  rowDepth?: number;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  isColumnTotal?: boolean;
}

export type CustomizeCellFn = (ctx: CustomizeCellContext) => CustomizeCellStyle | null | undefined | void;

// ============================================
// HISOBLANGAN NATIJA TIPLARI
// ============================================

export interface PivotData {
  headers: PivotHeader[][];
  rows: PivotRow[];
  /** Ustun jami qatori (showColumnTotals) */
  columnTotals?: PivotTotalRow;
  grandTotal?: PivotTotalRow;
  metadata: PivotMetadata;
}

export interface PivotHeader {
  key: string;
  label: string;
  colspan: number;
  rowspan: number;
  depth: number;
  isValue: boolean;
}

export interface PivotRow {
  key: string;
  depth: number;
  cells: PivotCell[];
  subtotal?: PivotTotalRow;
  isExpanded?: boolean;
  parentKey?: string;
  children?: PivotRow[];
}

export interface PivotCellDrillContext {
  rowGroupKey: string;
  colCubeKey: string;
  valueFieldId: string;
}

export interface PivotCell {
  value: number | string | null;
  rawValue: number | null;
  formatted: string;
  columnKey: string;
  isEmpty: boolean;
  /** Drill-through uchun manba qatorlarni filtrlash konteksti */
  drillContext?: PivotCellDrillContext;
}

export interface PivotTotalRow {
  cells: PivotCell[];
  label: string;
}

export interface PivotMetadata {
  totalRows: number;
  processedRows: number;
  executionTime: number;
  warnings: string[];
  /** To'liq natija CubeStore/result keshidan qaytarildi */
  fromCache?: boolean;
  /** Faqat yangi qatorlar cube ga qo'shildi (append-only diff) */
  incremental?: boolean;
}

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
  /**
   * true — har doim valyuta matni (soʻm/UZS…);
   * omit/false — odatda yashirin; pivotda 2+ valyuta bo‘lsa engine yoqadi.
   */
  showCurrency?: boolean;
  /** Minglik ajratuvchi (bo‘sh joy / vergul / nuqta) */
  thousandsSep?: "space" | "," | ".";
  /** O‘nlik ajratuvchi */
  decimalSep?: "." | ",";
  /** Manfiy son ko‘rinishi: -1 yoki (1) */
  negativeFormat?: "minus" | "parens";
  /** null/undefined uchun matn (default: —) */
  nullDisplay?: string;
  /** Excel-uslubidagi shablon (#,##0.00) — asosan UI xotirasi */
  numberPattern?: string;
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
  /**
   * WDR «Calculate individual values» — formulani har bir qator uchun
   * (aggregatsiyadan oldin) hisoblash. Hozircha flag saqlanadi; apply path
   * allaqachon qator darajasida ishlaydi.
   */
  individual?: boolean;
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
  | "lte"
  | "between";

export interface ConditionalFormatRule {
  id?: string;
  /** Metrika maydoni; berilmasa barcha qiymat kataklariga */
  fieldId?: string;
  type: ConditionalFormatRuleType;
  /** gt/lt/eq/gte/lte — chegara; between — pastki chegara (min) */
  threshold?: number;
  /** between — yuqori chegara (max), inkluziv */
  thresholdMax?: number;
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

/** WDR grid.type ekvivalenti: compact | classic | flat */
export type PivotLayoutForm = "compact" | "classic" | "flat";

/**
 * WDR virtual «Σ Values» / «Measures» axis:
 * - columns — metrikalar yonma-yon ustun sarlavhalari (klassik)
 * - rows — metrikalar qator darajasi sifatida (stacked)
 */
export type PivotValuesPosition = "rows" | "columns";

export interface PivotOptions {
  showSubtotals: boolean;
  showGrandTotal: boolean;
  showColumnTotals: boolean;
  /** @deprecated Prefer `layoutForm`. `true` ≈ compact. */
  compactMode: boolean;
  /** Jadval sxemasi: kompakt / klassik / tekis (raw) */
  layoutForm?: PivotLayoutForm;
  /**
   * WDR «Σ Values» o‘qi: metrikalar qatorlarda yoki ustunlarda.
   * Default: `"columns"`.
   */
  valuesPosition?: PivotValuesPosition;
  /**
   * WDR virtual «Σ Values» chip index within the active axis zone (`rows` or `columns`).
   * `0` = before first field, `fieldIds.length` = after last field. Default: end.
   */
  valuesAxisIndex?: number;
  sortBy?: { fieldId: string; direction: "asc" | "desc" };
  drillDown: boolean;
  /**
   * true — qiymat katakchasiga ikki marta bosish «Исходные записи» ochadi.
   * Default: false (tasodifiy ochilishni oldini olish).
   */
  drillThrough?: boolean;
  maxRows?: number;
  conditionalFormats?: ConditionalFormatRule[];
  /** Jadval o'lchamlari (WDR Table Sizes ekvivalenti) */
  tableSizes?: PivotTableSizes;
  /**
   * WDR «Формат даты»:
   * by_columns — Yil/Oy/Kun qismlari; date — sana matni; datetime — sana+vaqt.
   */
  dateDisplayMode?: "by_columns" | "date" | "datetime";
  /** date rejimi pattern (masalan `dd.MM.yyyy`) */
  datePattern?: string;
  /** datetime rejimi pattern (masalan `dd.MM.yyyy HH:mm:ss`) */
  dateTimePattern?: string;
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

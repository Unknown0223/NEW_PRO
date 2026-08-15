import type { AggregationType, PivotConfig, PivotFilter, PivotValue } from "../types/pivot.types.js";
import { DEFAULT_PIVOT_CONFIG } from "../core/defaults.js";
import { isWdrMeasuresFieldId, type PivotValuesPosition } from "../utils/valuesPosition.js";

/** WebDataRocks slice minimal shakli (clean-room, hujjat asosida). */
export type WdrSliceField = {
  uniqueName?: string;
  caption?: string;
  filter?: {
    members?: string[];
    exclude?: boolean;
  };
};

export type WdrSliceMeasure = {
  uniqueName?: string;
  aggregation?: string;
  caption?: string;
};

export type WdrSliceJson = {
  rows?: WdrSliceField[];
  columns?: WdrSliceField[];
  measures?: WdrSliceMeasure[];
  reportFilters?: WdrSliceField[];
};

const WDR_AGG_MAP: Record<string, AggregationType> = {
  sum: "SUM",
  count: "COUNT",
  average: "AVG",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
  distinctcount: "COUNT_DISTINCT",
  distinct: "COUNT_DISTINCT",
  percent: "PERCENT_OF_TOTAL",
  percentoftotal: "PERCENT_OF_TOTAL",
  percentofrow: "PERCENT_OF_ROW",
  percentofcolumn: "PERCENT_OF_COLUMN",
  product: "PRODUCT",
  index: "INDEX",
  difference: "DIFFERENCE",
  runningtotals: "RUNNING_TOTAL"
};

export function mapWdrAggregation(wdrAgg?: string): AggregationType {
  const key = String(wdrAgg ?? "sum")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  return WDR_AGG_MAP[key] ?? "SUM";
}

/** WDR ba'zan `amount.sum` kabi uniqueName ishlatadi. */
export function parseWdrFieldId(uniqueName?: string): string {
  const raw = String(uniqueName ?? "").trim();
  if (!raw) return "";
  const dot = raw.indexOf(".");
  return dot > 0 ? raw.slice(0, dot) : raw;
}

function fieldIds(fields?: WdrSliceField[]): string[] {
  if (!fields?.length) return [];
  return fields
    .map((f) => parseWdrFieldId(f.uniqueName))
    .filter((id) => Boolean(id) && !isWdrMeasuresFieldId(id));
}

function detectValuesPosition(slice: WdrSliceJson): PivotValuesPosition {
  const inRows = (slice.rows ?? []).some((f) => isWdrMeasuresFieldId(parseWdrFieldId(f.uniqueName)));
  if (inRows) return "rows";
  const inColumns = (slice.columns ?? []).some((f) =>
    isWdrMeasuresFieldId(parseWdrFieldId(f.uniqueName))
  );
  if (inColumns) return "columns";
  return "columns";
}

function wdrFilterToPivot(field: WdrSliceField): PivotFilter | null {
  const fieldId = parseWdrFieldId(field.uniqueName);
  if (!fieldId || isWdrMeasuresFieldId(fieldId)) return null;

  const members = field.filter?.members;
  if (!members?.length) {
    return { fieldId, type: "include", values: [] };
  }

  return {
    fieldId,
    type: field.filter?.exclude ? "exclude" : "include",
    values: members.map((m) => m)
  };
}

function measuresToValues(measures?: WdrSliceMeasure[]): PivotValue[] {
  if (!measures?.length) {
    return [{ fieldId: "amount", aggregation: "SUM", label: "Summa" }];
  }

  return measures.map((m) => {
    const raw = String(m.uniqueName ?? "").trim();
    const fieldId = parseWdrFieldId(raw);
    let aggregation = mapWdrAggregation(m.aggregation);
    if (raw.includes(".") && !m.aggregation) {
      const suffix = raw.slice(raw.indexOf(".") + 1);
      aggregation = mapWdrAggregation(suffix);
    }
    return {
      fieldId,
      label: m.caption ?? fieldId,
      aggregation
    };
  });
}

/**
 * WDR `slice` JSON → `PivotConfig`.
 * `reportFilters` va slice ichidagi `filter.members` qo'llab-quvvatlanadi.
 * Virtual `Measures` → `options.valuesPosition`.
 */
export function wdrSliceToPivotConfig(
  slice: WdrSliceJson,
  base: Partial<PivotConfig> = {}
): PivotConfig {
  const reportFilterIds = fieldIds(slice.reportFilters);
  const filters: PivotFilter[] = [];
  const valuesPosition = detectValuesPosition(slice);

  for (const zone of [slice.reportFilters, slice.rows, slice.columns]) {
    for (const field of zone ?? []) {
      const pf = wdrFilterToPivot(field);
      if (pf && pf.values && pf.values.length > 0) filters.push(pf);
    }
  }

  return {
    ...DEFAULT_PIVOT_CONFIG,
    ...base,
    rows: fieldIds(slice.rows),
    columns: fieldIds(slice.columns),
    reportFilters: reportFilterIds.length > 0 ? reportFilterIds : base.reportFilters ?? [],
    values: measuresToValues(slice.measures),
    filters: filters.length > 0 ? filters : base.filters ?? [],
    options: {
      ...DEFAULT_PIVOT_CONFIG.options,
      ...base.options,
      valuesPosition: base.options?.valuesPosition ?? valuesPosition
    }
  };
}

/** Saqlangan WDR report (slice + ixtiyoriy dataset filtrlari). */
export type WdrSavedReport = {
  slice?: WdrSliceJson;
  savdoDatasetFilters?: Record<string, unknown>;
};

export function wdrReportToPivotConfig(report: WdrSavedReport): PivotConfig {
  const slice =
    report.slice ??
    (report as { config?: { slice?: WdrSliceJson } }).config?.slice ??
    {};
  return wdrSliceToPivotConfig(slice);
}

/** Saqlangan hisobot WDR `getReport()` formatidami (slice + dataSource). */
export function isWdrSavedReportConfig(config: unknown): config is WdrSavedReport & {
  dataSource?: unknown;
  slice: WdrSliceJson;
} {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  if (c.slice != null && typeof c.slice === "object") return true;
  return c.dataSource != null && typeof c.dataSource === "object" && c.slice != null;
}

/** WDR yoki legacy PivotConfig ni aniqlash. */
export function detectSavedReportFormat(
  config: unknown
): "wdr" | "pivot" | "unknown" {
  if (isWdrSavedReportConfig(config)) return "wdr";
  if (config && typeof config === "object" && "values" in config && Array.isArray((config as PivotConfig).values)) {
    return "pivot";
  }
  if (config && typeof config === "object" && "rowFieldIds" in config) return "unknown";
  return "unknown";
}

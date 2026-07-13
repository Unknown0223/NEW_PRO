import { DEFAULT_PIVOT_CONFIG } from "../core/PivotEngine.js";
const WDR_AGG_MAP = {
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
export function mapWdrAggregation(wdrAgg) {
    const key = String(wdrAgg ?? "sum")
        .toLowerCase()
        .replace(/[\s_-]/g, "");
    return WDR_AGG_MAP[key] ?? "SUM";
}
/** WDR ba'zan `amount.sum` kabi uniqueName ishlatadi. */
export function parseWdrFieldId(uniqueName) {
    const raw = String(uniqueName ?? "").trim();
    if (!raw)
        return "";
    const dot = raw.indexOf(".");
    return dot > 0 ? raw.slice(0, dot) : raw;
}
function fieldIds(fields) {
    if (!fields?.length)
        return [];
    return fields.map((f) => parseWdrFieldId(f.uniqueName)).filter(Boolean);
}
function wdrFilterToPivot(field) {
    const fieldId = parseWdrFieldId(field.uniqueName);
    if (!fieldId)
        return null;
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
function measuresToValues(measures) {
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
 */
export function wdrSliceToPivotConfig(slice, base = {}) {
    const reportFilterIds = fieldIds(slice.reportFilters);
    const filters = [];
    for (const zone of [slice.reportFilters, slice.rows, slice.columns]) {
        for (const field of zone ?? []) {
            const pf = wdrFilterToPivot(field);
            if (pf && pf.values && pf.values.length > 0)
                filters.push(pf);
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
            ...base.options
        }
    };
}
export function wdrReportToPivotConfig(report) {
    const slice = report.slice ??
        report.config?.slice ??
        {};
    return wdrSliceToPivotConfig(slice);
}
/** Saqlangan hisobot WDR `getReport()` formatidami (slice + dataSource). */
export function isWdrSavedReportConfig(config) {
    if (!config || typeof config !== "object")
        return false;
    const c = config;
    if (c.slice != null && typeof c.slice === "object")
        return true;
    return c.dataSource != null && typeof c.dataSource === "object" && c.slice != null;
}
/** WDR yoki legacy PivotConfig ni aniqlash. */
export function detectSavedReportFormat(config) {
    if (isWdrSavedReportConfig(config))
        return "wdr";
    if (config && typeof config === "object" && "values" in config && Array.isArray(config.values)) {
        return "pivot";
    }
    if (config && typeof config === "object" && "rowFieldIds" in config)
        return "unknown";
    return "unknown";
}

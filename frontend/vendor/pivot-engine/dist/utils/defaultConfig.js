import { DEFAULT_PIVOT_CONFIG } from "../core/defaults.js";
/** Bo'sh konfiguratsiya uchun mantiqiy default slice: birinchi matnli qator + birinchi sonli metrika. */
export function createDefaultPivotConfig(fields) {
    if (!fields.length)
        return {};
    const firstString = fields.find((f) => f.dataType === "string" || f.dataType === "date");
    const firstNumeric = fields.find((f) => f.dataType === "number" || f.dataType === "currency");
    return {
        rows: firstString ? [firstString.id] : [],
        values: firstNumeric
            ? [
                {
                    fieldId: firstNumeric.id,
                    label: firstNumeric.label,
                    aggregation: "SUM",
                    format: firstNumeric.format
                }
            ]
            : []
    };
}
/** Konfiguratsiya bo'shmi (qator va qiymat yo'q). */
export function isEmptyPivotConfig(config) {
    return config.rows.length === 0 && config.columns.length === 0 && config.values.length === 0;
}
/** Maydonlar bilan to'liq default konfiguratsiya. */
export function resolvePivotConfig(config, fields) {
    if (!isEmptyPivotConfig(config))
        return config;
    const defaults = createDefaultPivotConfig(fields);
    return {
        ...DEFAULT_PIVOT_CONFIG,
        ...config,
        ...defaults,
        options: { ...DEFAULT_PIVOT_CONFIG.options, ...config.options }
    };
}

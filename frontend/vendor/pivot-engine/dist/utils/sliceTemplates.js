import { DEFAULT_PIVOT_CONFIG } from "../core/PivotEngine.js";
import { getPivotStrings } from "../i18n/index.js";
const TEMPLATE_CONFIGS = {
    agent_kpi: {
        rows: ["supervisor_code", "agent_name"],
        columns: [],
        reportFilters: ["order_status"],
        values: [
            { fieldId: "amount", aggregation: "SUM" },
            { fieldId: "client_id", aggregation: "COUNT_DISTINCT" }
        ]
    },
    retrobonus_volume: {
        rows: ["agent_name"],
        columns: [],
        values: [{ fieldId: "volume", aggregation: "SUM" }]
    }
};
export function getPivotSliceTemplates() {
    return getPivotStrings().sliceTemplates.map((meta) => ({
        ...meta,
        config: TEMPLATE_CONFIGS[meta.id] ?? {}
    }));
}
function filterKnownFieldIds(ids, fieldIds) {
    return (ids ?? []).filter((id) => fieldIds.has(id));
}
/** Slice shablonini mavjud maydonlar bilan qo'llaydi. */
export function applyPivotSliceTemplate(templateId, fields, base = DEFAULT_PIVOT_CONFIG) {
    const template = getPivotSliceTemplates().find((t) => t.id === templateId);
    if (!template)
        return null;
    const fieldIds = new Set(fields.map((f) => f.id));
    const partial = template.config;
    const values = (partial.values ?? []).filter((v) => fieldIds.has(v.fieldId));
    if (!values.length)
        return null;
    return {
        ...base,
        rows: filterKnownFieldIds(partial.rows, fieldIds),
        columns: filterKnownFieldIds(partial.columns, fieldIds),
        reportFilters: filterKnownFieldIds(partial.reportFilters, fieldIds),
        values,
        filters: [],
        calculatedMeasures: partial.calculatedMeasures
    };
}

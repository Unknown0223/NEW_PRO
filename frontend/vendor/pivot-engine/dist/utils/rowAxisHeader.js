import { getPivotStrings } from "../i18n/index.js";
/**
 * Caption for the synthetic `__row_label__` header.
 * Single row dimension → field catalog label (e.g. «Агент»), not generic «Группа».
 */
export function resolveRowAxisHeaderLabel(config, fields, fallback) {
    const groupFallback = fallback ?? getPivotStrings().engine.group;
    if (config.rows.length === 1) {
        const fieldId = config.rows[0];
        const field = fields.find((f) => f.id === fieldId);
        const label = field?.label?.trim();
        if (label)
            return label;
        return fieldId;
    }
    if (config.rows.length > 1)
        return groupFallback;
    return "";
}

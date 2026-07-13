function matchRule(cell, rule) {
    if (cell.columnKey === "__row_label__" || cell.isEmpty)
        return false;
    if (rule.fieldId) {
        const matchesField = cell.columnKey === rule.fieldId ||
            cell.columnKey.endsWith(`__${rule.fieldId}`) ||
            cell.columnKey.includes(`__${rule.fieldId}`);
        if (!matchesField)
            return false;
    }
    const value = cell.rawValue;
    if (value == null || !Number.isFinite(value)) {
        return rule.type === "negative" && typeof value === "number" && value < 0;
    }
    switch (rule.type) {
        case "negative":
            return value < 0;
        case "gt":
            return rule.threshold != null && value > rule.threshold;
        case "lt":
            return rule.threshold != null && value < rule.threshold;
        case "eq":
            return rule.threshold != null && value === rule.threshold;
        case "gte":
            return rule.threshold != null && value >= rule.threshold;
        case "lte":
            return rule.threshold != null && value <= rule.threshold;
        default:
            return false;
    }
}
/** Birinchi mos qoida uslubini qaytaradi (WDR conditional formatting soddalashtirilgan). */
export function getConditionalFormatStyle(cell, rules) {
    if (!rules?.length)
        return undefined;
    for (const rule of rules) {
        if (!matchRule(cell, rule))
            continue;
        return {
            backgroundColor: rule.backgroundColor,
            textColor: rule.textColor
        };
    }
    return undefined;
}

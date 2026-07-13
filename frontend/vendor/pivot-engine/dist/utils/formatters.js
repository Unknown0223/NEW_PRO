const EMPTY_VALUE = "—";
const DEFAULT_LOCALE = "uz-UZ";
/**
 * Son, valyuta, foiz va sanani O'zbekiston locale (uz-UZ) bo'yicha formatlaydi.
 */
export function formatValue(value, format) {
    if (value === null || value === undefined)
        return EMPTY_VALUE;
    if (!format) {
        if (typeof value === "number")
            return value.toLocaleString(DEFAULT_LOCALE);
        if (value instanceof Date)
            return formatDate(value, format);
        return String(value);
    }
    switch (format.type) {
        case "currency":
            return formatCurrency(Number(value), format);
        case "percent":
            return formatPercent(Number(value), format);
        case "date":
            return formatDate(value instanceof Date ? value : new Date(String(value)), format);
        case "number":
            return formatNumber(Number(value), format);
        default:
            return String(value);
    }
}
export function formatCurrency(value, format) {
    if (!Number.isFinite(value))
        return EMPTY_VALUE;
    const currency = format?.currency ?? "UZS";
    const decimals = format?.decimals ?? 0;
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}
export function formatPercent(value, format) {
    if (!Number.isFinite(value))
        return EMPTY_VALUE;
    const decimals = format?.decimals ?? 1;
    return `${value.toFixed(decimals)}%`;
}
export function formatNumber(value, format) {
    if (!Number.isFinite(value))
        return EMPTY_VALUE;
    const decimals = format?.decimals ?? 0;
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: format?.decimals ?? 2
    }).format(value);
}
export function formatDate(date, format) {
    if (Number.isNaN(date.getTime()))
        return EMPTY_VALUE;
    const pattern = format?.dateFormat ?? "DD.MM.YYYY";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    return pattern
        .replace("DD", day)
        .replace("MM", month)
        .replace("YYYY", year);
}
export function formatUzNumber(value) {
    return value.toLocaleString(DEFAULT_LOCALE);
}

const EMPTY_VALUE = "—";
const DEFAULT_LOCALE = "uz-UZ";
/**
 * Pivot value/field formatlaridan unique valyuta kodlari.
 * Bitta kod → suffix kerak emas; 2+ → ko‘rsatiladi.
 */
export function collectCurrencyCodesFromPivot(config, fields = []) {
    const fieldMap = new Map(fields.map((f) => [f.id, f]));
    const codes = new Set();
    const addIfCurrency = (fmt, dataType) => {
        const isCurrency = fmt?.type === "currency" || dataType === "currency";
        if (!isCurrency)
            return;
        codes.add((fmt?.currency ?? "UZS").toUpperCase());
    };
    for (const v of config.values) {
        const field = fieldMap.get(v.fieldId);
        addIfCurrency(v.format ?? field?.format, field?.dataType);
    }
    for (const m of config.calculatedMeasures ?? []) {
        addIfCurrency(m.format);
    }
    return [...codes];
}
/** Ikki yoki undan ortiq turli valyuta bo‘lsa — suffix kerak. */
export function shouldShowCurrencySuffix(config, fields = []) {
    return collectCurrencyCodesFromPivot(config, fields).length > 1;
}
function emptyDisplay(format) {
    if (format?.nullDisplay != null && format.nullDisplay !== "")
        return format.nullDisplay;
    return EMPTY_VALUE;
}
/** Custom minglik/o‘nlik ajratuvchilar bilan formatlash. */
export function formatNumberWithSeparators(value, format) {
    if (!Number.isFinite(value))
        return emptyDisplay(format);
    const decimals = format?.decimals ?? 0;
    const thousandsSep = format?.thousandsSep ?? "space";
    const decimalSep = format?.decimalSep ?? ".";
    const negativeFormat = format?.negativeFormat ?? "minus";
    const abs = Math.abs(value);
    const fixed = abs.toFixed(decimals);
    const [intRaw, frac] = fixed.split(".");
    const intPart = intRaw ?? "0";
    const group = thousandsSep === "space" ? "\u00A0" : thousandsSep;
    const withGroups = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    let result = decimals > 0 && frac != null ? `${withGroups}${decimalSep}${frac}` : withGroups;
    if (value < 0) {
        result = negativeFormat === "parens" ? `(${result})` : `-${result}`;
    }
    return result;
}
function hasCustomNumberStyle(format) {
    if (!format)
        return false;
    return (format.thousandsSep != null ||
        format.decimalSep != null ||
        format.negativeFormat != null);
}
/**
 * Son, valyuta, foiz va sanani O'zbekiston locale (uz-UZ) bo'yicha formatlaydi.
 */
export function formatValue(value, format, opts) {
    if (value === null || value === undefined)
        return emptyDisplay(format);
    if (!format) {
        if (typeof value === "number")
            return value.toLocaleString(DEFAULT_LOCALE);
        if (value instanceof Date)
            return formatDate(value, format);
        return String(value);
    }
    switch (format.type) {
        case "currency":
            return formatCurrency(Number(value), format, opts);
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
export function formatCurrency(value, format, opts) {
    if (!Number.isFinite(value))
        return emptyDisplay(format);
    const decimals = format?.decimals ?? 0;
    /** Faqat pivot multi-currency signalidan — format.showCurrency saqlangan configdan majburlamasin. */
    const showCurrency = opts?.showCurrency === true;
    // Bitta valyuta: faqat son (masalan «11 057 200»). Boshqa valyuta qo‘shilganda suffix.
    if (!showCurrency) {
        return formatNumber(value, { ...format, type: "number", decimals });
    }
    if (hasCustomNumberStyle(format)) {
        const num = formatNumberWithSeparators(value, { ...format, type: "number", decimals });
        const currency = format?.currency ?? "UZS";
        return `${num}\u00A0${currency}`;
    }
    const currency = format?.currency ?? "UZS";
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}
export function formatPercent(value, format) {
    if (!Number.isFinite(value))
        return emptyDisplay(format);
    const decimals = format?.decimals ?? 1;
    if (hasCustomNumberStyle(format)) {
        return `${formatNumberWithSeparators(value, { ...format, type: "number", decimals })}%`;
    }
    return `${value.toFixed(decimals)}%`;
}
export function formatNumber(value, format) {
    if (!Number.isFinite(value))
        return emptyDisplay(format);
    if (hasCustomNumberStyle(format)) {
        return formatNumberWithSeparators(value, format);
    }
    const decimals = format?.decimals ?? 0;
    let result = new Intl.NumberFormat(DEFAULT_LOCALE, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: format?.decimals ?? 2
    }).format(value);
    if (value < 0 && format?.negativeFormat === "parens") {
        result = `(${result.replace(/^-/, "")})`;
    }
    return result;
}
export function formatDate(date, format) {
    if (Number.isNaN(date.getTime()))
        return emptyDisplay(format);
    const pattern = format?.dateFormat ?? "dd.MM.yyyy";
    const pad = (n) => String(n).padStart(2, "0");
    const tokens = [
        ["yyyy", String(date.getFullYear())],
        ["YYYY", String(date.getFullYear())],
        ["MM", pad(date.getMonth() + 1)],
        ["dd", pad(date.getDate())],
        ["DD", pad(date.getDate())],
        ["HH", pad(date.getHours())],
        ["mm", pad(date.getMinutes())],
        ["ss", pad(date.getSeconds())]
    ];
    let result = pattern;
    for (const [token, value] of tokens) {
        if (!result.includes(token))
            continue;
        result = result.split(token).join(value);
    }
    return result;
}
export function formatUzNumber(value) {
    return value.toLocaleString(DEFAULT_LOCALE);
}

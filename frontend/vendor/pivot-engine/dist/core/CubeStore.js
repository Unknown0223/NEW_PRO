/** Ma'lumot va agregatsiya konfiguratsiyasi bo'yicha cube keshi. */
export class CubeStore {
    constructor() {
        this.cache = new Map();
        this.maxEntries = 8;
    }
    get(dataHash, configHash) {
        return this.cache.get(`${dataHash}|${configHash}`);
    }
    set(entry) {
        const key = `${entry.dataHash}|${entry.configHash}`;
        if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        this.cache.set(key, entry);
    }
    clear() {
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
}
/** Ma'lumot massivi uchun oddiy kontent xeshi. */
export function hashPivotData(data) {
    if (data.length === 0)
        return "empty";
    const first = data[0];
    const last = data[data.length - 1];
    let checksum = data.length;
    const sample = [first, last];
    for (const row of sample) {
        if (!row)
            continue;
        for (const v of Object.values(row)) {
            if (typeof v === "number" && Number.isFinite(v))
                checksum += v;
        }
    }
    return `${data.length}:${checksum}`;
}
/** Agregatsiya uchun konfig xeshi (sort va ko'rinish opsiyalari tashqari). */
export function hashAggregationConfig(config) {
    const agg = {
        rows: config.rows,
        columns: config.columns,
        values: config.values,
        reportFilters: config.reportFilters,
        filters: config.filters,
        calculatedMeasures: config.calculatedMeasures ?? [],
        showSubtotals: config.options.showSubtotals,
        showGrandTotal: config.options.showGrandTotal,
        showColumnTotals: config.options.showColumnTotals,
        drillDown: config.options.drillDown,
        maxRows: config.options.maxRows,
        conditionalFormats: config.options.conditionalFormats
    };
    return JSON.stringify(agg);
}
/** To'liq konfig (tartiblash bilan) — natija keshi kaliti. */
export function hashFullConfig(config) {
    return JSON.stringify(config);
}
/**
 * Yangi ma'lumot eskisining faqat qo'shimcha qatorlari ekanini tekshiradi.
 * Prefix xeshi mos kelsa append-only deb hisoblanadi.
 */
export function isAppendOnlyDataUpdate(prev, next) {
    if (prev.length === 0 || next.length <= prev.length)
        return false;
    return hashPivotData(prev) === hashPivotData(next.slice(0, prev.length));
}
/** Faqat tartiblash o'zgarganini aniqlash. */
export function isSortOnlyChange(prev, next) {
    const prevSort = JSON.stringify(prev.options.sortBy ?? null);
    const nextSort = JSON.stringify(next.options.sortBy ?? null);
    if (prevSort === nextSort)
        return false;
    const prevAgg = { ...prev, options: { ...prev.options, sortBy: undefined } };
    const nextAgg = { ...next, options: { ...next.options, sortBy: undefined } };
    return hashAggregationConfig(prevAgg) === hashAggregationConfig(nextAgg);
}

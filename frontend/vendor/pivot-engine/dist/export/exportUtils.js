import { CHART_LARGE_DATASET_THRESHOLD } from "../chart/pivotToChartData.js";
import { getPivotStrings } from "../i18n/index.js";
/** Eksport uchun katta dataset chegarasi (grafik bilan bir xil). */
export const EXPORT_LARGE_DATASET_THRESHOLD = CHART_LARGE_DATASET_THRESHOLD;
/** UI bloklanmasligi uchun qatorlar batch hajmi. */
export const EXPORT_CHUNK_SIZE = 5000;
export function yieldToMain() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}
/** Eksport qilinadigan jadval qatorlari (subtotal va grand total bilan). */
export function countPivotExportRows(data, options = {}) {
    let count = 0;
    const includeSubtotals = options.includeSubtotals !== false;
    const expandAll = !options.expandedRows;
    function walk(row) {
        count++;
        const expanded = expandAll || options.expandedRows.has(row.key);
        if (!expanded || !row.children?.length)
            return;
        for (const child of row.children)
            walk(child);
        if (includeSubtotals && row.subtotal)
            count++;
    }
    for (const row of data.rows)
        walk(row);
    if (data.grandTotal)
        count++;
    return count;
}
export function getExportWarnings(data, options = {}) {
    const t = getPivotStrings().export;
    const warnings = [];
    const sourceRows = options.sourceRowCount ?? data.metadata.processedRows ?? data.metadata.totalRows;
    const exportRows = countPivotExportRows(data, options);
    if (sourceRows >= EXPORT_LARGE_DATASET_THRESHOLD) {
        warnings.push(t.largeSourceWarning(sourceRows));
    }
    if (exportRows >= EXPORT_LARGE_DATASET_THRESHOLD) {
        warnings.push(t.largeExportWarning(exportRows));
    }
    return warnings;
}
export function shouldConfirmLargeExport(data, options = {}) {
    const sourceRows = options.sourceRowCount ?? data.metadata.processedRows ?? data.metadata.totalRows;
    const exportRows = countPivotExportRows(data, options);
    return (sourceRows >= EXPORT_LARGE_DATASET_THRESHOLD ||
        exportRows >= EXPORT_LARGE_DATASET_THRESHOLD);
}
export function formatExportProgressLabel(progress) {
    const t = getPivotStrings().export;
    if (progress.phase === "writing")
        return t.writing;
    if (progress.phase === "done")
        return t.done;
    if (progress.totalRows > 0 && progress.processedRows > 0) {
        return t.progress(progress.processedRows, progress.totalRows);
    }
    return t.preparing;
}

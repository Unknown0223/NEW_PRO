import { pivotDataToAoA } from "./ExportExcel.js";
import { countPivotExportRows, yieldToMain } from "./exportUtils.js";
const DEFAULT_FILENAME = "pivot-export.pdf";
/** PivotData → jspdf-autotable uchun head/body (smoke test va export uchun). */
export function pivotDataToPdfTable(data, options = {}) {
    const aoa = pivotDataToAoA(data, {
        useFormattedValues: options.useFormattedValues,
        includeSubtotals: options.includeSubtotals,
        expandedRows: options.expandedRows
    });
    if (aoa.length === 0)
        return { head: [], body: [] };
    const headerLevels = data.headers.length;
    const head = aoa.slice(0, headerLevels).map((row) => row.map(String));
    const body = aoa.slice(headerLevels);
    return { head, body };
}
/** @deprecated countPivotExportRows ishlating */
export function countPdfExportRows(data, expandedRows) {
    return countPivotExportRows(data, { expandedRows });
}
/**
 * Pivot jadvalini PDF sifatida yuklab olish (browser).
 * jspdf + jspdf-autotable dynamic import — bundle hajmini kamaytirish.
 */
export async function exportPivotToPdf(data, options = {}) {
    const onProgress = options.onProgress;
    const totalRows = countPivotExportRows(data, options);
    onProgress?.({ phase: "preparing", processedRows: 0, totalRows });
    await yieldToMain();
    const [{ default: jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable")
    ]);
    const autoTable = autoTableModule.default;
    const { head, body } = pivotDataToPdfTable(data, options);
    onProgress?.({ phase: "preparing", processedRows: totalRows, totalRows });
    await yieldToMain();
    const doc = new jsPDF({ orientation: body[0] && body[0].length > 6 ? "landscape" : "portrait" });
    if (options.title) {
        doc.setFontSize(12);
        doc.text(options.title, 14, 14);
    }
    const startY = options.title ? 20 : 10;
    onProgress?.({ phase: "writing", processedRows: totalRows, totalRows });
    await yieldToMain();
    autoTable(doc, {
        head: head.length > 0 ? head : undefined,
        body,
        startY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30] },
        margin: { top: startY }
    });
    const filename = options.filename ?? DEFAULT_FILENAME;
    const output = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    doc.save(output);
    onProgress?.({ phase: "done", processedRows: totalRows, totalRows });
}

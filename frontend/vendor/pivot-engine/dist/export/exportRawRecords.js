import * as XLSX from "xlsx";
function formatExportCell(value) {
    if (value == null)
        return "";
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    return String(value);
}
/** Drill-through yoki xom qatorlarni Excel/CSV ga eksport qilish. */
export function exportRawRecordsToExcel(records, columns, options = {}) {
    const sheetName = options.sheetName ?? "Drill-through";
    const filename = options.filename ?? "drill-through.xlsx";
    const header = columns.map((c) => c.label);
    const rows = records.map((record) => columns.map((col) => formatExportCell(record[col.id])));
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
}
/** Oddiy CSV yuklab olish (Excel kutubxonasiz fallback). */
export function exportRawRecordsToCsv(records, columns, options = {}) {
    const filename = options.filename ?? "drill-through.csv";
    const escape = (value) => {
        if (/[",\n]/.test(value))
            return `"${value.replace(/"/g, '""')}"`;
        return value;
    };
    const lines = [
        columns.map((c) => escape(c.label)).join(","),
        ...records.map((record) => columns.map((col) => escape(String(formatExportCell(record[col.id])))).join(","))
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

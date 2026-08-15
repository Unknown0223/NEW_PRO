import * as XLSX from "xlsx";
import { countPivotExportRows, EXPORT_CHUNK_SIZE, yieldToMain } from "./exportUtils.js";
const DEFAULT_SHEET = "Pivot";
const DEFAULT_FILENAME = "pivot-export.xlsx";
function cellDisplayValue(cell, useFormatted) {
    if (useFormatted) {
        return cell.formatted || (cell.value == null ? "" : String(cell.value));
    }
    if (cell.rawValue != null && Number.isFinite(cell.rawValue))
        return cell.rawValue;
    if (typeof cell.value === "number" && Number.isFinite(cell.value))
        return cell.value;
    return cell.formatted || (cell.value == null ? "" : String(cell.value));
}
function hasRowLabel(data) {
    return data.rows.some((row) => row.cells.some((cell) => cell.columnKey === "__row_label__"));
}
function countDataColumns(data) {
    const lastLevel = data.headers[data.headers.length - 1];
    if (!lastLevel?.length) {
        return Math.max(0, (data.rows[0]?.cells.length ?? 1) - (hasRowLabel(data) ? 1 : 0));
    }
    return lastLevel
        .filter((header) => header.key !== "__row_label__")
        .reduce((sum, header) => sum + header.colspan, 0);
}
export function buildHeaderMatrix(data) {
    const headerLevels = data.headers.length;
    if (headerLevels === 0) {
        return { matrix: [], merges: [] };
    }
    const showRowLabel = hasRowLabel(data);
    const dataCols = countDataColumns(data);
    const totalCols = showRowLabel ? 1 + dataCols : dataCols;
    const matrix = Array.from({ length: headerLevels }, () => Array(totalCols).fill(""));
    const merges = [];
    for (let levelIdx = 0; levelIdx < headerLevels; levelIdx++) {
        const level = data.headers[levelIdx];
        let col = showRowLabel ? 1 : 0;
        for (const header of level) {
            if (header.key === "__row_label__") {
                matrix[0][0] = header.label;
                if (header.rowspan > 1) {
                    merges.push({
                        s: { r: 0, c: 0 },
                        e: { r: header.rowspan - 1, c: 0 }
                    });
                }
                continue;
            }
            const startCol = col;
            matrix[levelIdx][startCol] = header.label;
            const endCol = startCol + header.colspan - 1;
            const endRow = levelIdx + header.rowspan - 1;
            if (header.colspan > 1 || header.rowspan > 1) {
                merges.push({
                    s: { r: levelIdx, c: startCol },
                    e: { r: endRow, c: endCol }
                });
            }
            col += header.colspan;
        }
    }
    return { matrix, merges };
}
function flattenRows(rows, options) {
    const result = [];
    const useFormatted = options.useFormattedValues !== false;
    const includeSubtotals = options.includeSubtotals !== false;
    const expandAll = !options.expandedRows;
    function appendRow(row, depth) {
        const line = row.cells.map((cell) => {
            if (cell.columnKey === "__row_label__") {
                const label = useFormatted
                    ? cell.formatted || String(cell.value ?? "")
                    : String(cell.value ?? "");
                return depth > 0 ? `${"  ".repeat(depth)}${label}` : label;
            }
            return cellDisplayValue(cell, useFormatted);
        });
        result.push(line);
        const expanded = expandAll || options.expandedRows.has(row.key);
        if (!expanded || !row.children?.length)
            return;
        for (const child of row.children) {
            appendRow(child, depth + 1);
        }
        if (includeSubtotals && row.subtotal) {
            result.push(row.subtotal.cells.map((cell) => cellDisplayValue(cell, useFormatted)));
        }
    }
    for (const row of rows) {
        appendRow(row, 0);
    }
    return result;
}
async function flattenRowsChunked(rows, options, totalRows, onProgress) {
    const result = [];
    const useFormatted = options.useFormattedValues !== false;
    const includeSubtotals = options.includeSubtotals !== false;
    const expandAll = !options.expandedRows;
    let processed = 0;
    async function maybeYield() {
        if (processed > 0 && processed % EXPORT_CHUNK_SIZE === 0) {
            onProgress?.({ phase: "preparing", processedRows: processed, totalRows });
            await yieldToMain();
        }
    }
    async function appendRow(row, depth) {
        const line = row.cells.map((cell) => {
            if (cell.columnKey === "__row_label__") {
                const label = useFormatted
                    ? cell.formatted || String(cell.value ?? "")
                    : String(cell.value ?? "");
                return depth > 0 ? `${"  ".repeat(depth)}${label}` : label;
            }
            return cellDisplayValue(cell, useFormatted);
        });
        result.push(line);
        processed++;
        await maybeYield();
        const expanded = expandAll || options.expandedRows.has(row.key);
        if (!expanded || !row.children?.length)
            return;
        for (const child of row.children) {
            await appendRow(child, depth + 1);
        }
        if (includeSubtotals && row.subtotal) {
            result.push(row.subtotal.cells.map((cell) => cellDisplayValue(cell, useFormatted)));
            processed++;
            await maybeYield();
        }
    }
    for (const row of rows) {
        await appendRow(row, 0);
    }
    return result;
}
export function pivotDataToAoA(data, options = {}) {
    const { matrix: headerRows } = buildHeaderMatrix(data);
    const bodyRows = flattenRows(data.rows, options);
    const lines = [...headerRows, ...bodyRows];
    if (data.grandTotal) {
        const useFormatted = options.useFormattedValues !== false;
        lines.push(data.grandTotal.cells.map((cell) => cellDisplayValue(cell, useFormatted)));
    }
    return lines;
}
export function buildPivotWorksheet(data, options = {}) {
    const worksheet = XLSX.utils.aoa_to_sheet(pivotDataToAoA(data, options));
    const { merges } = buildHeaderMatrix(data);
    if (merges.length > 0) {
        worksheet["!merges"] = merges;
    }
    return worksheet;
}
export function buildPivotWorkbook(data, options = {}) {
    const worksheet = buildPivotWorksheet(data, options);
    const workbook = XLSX.utils.book_new();
    const sheetName = (options.sheetName ?? DEFAULT_SHEET).replace(/[:\\/?*[\]]/g, "_").slice(0, 31) ||
        DEFAULT_SHEET;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return workbook;
}
export async function exportPivotToExcel(data, options = {}) {
    const onProgress = options.onProgress;
    const totalRows = countPivotExportRows(data, options);
    onProgress?.({ phase: "preparing", processedRows: 0, totalRows });
    await yieldToMain();
    const useChunked = totalRows >= EXPORT_CHUNK_SIZE;
    const { matrix: headerRows, merges } = buildHeaderMatrix(data);
    const bodyRows = useChunked
        ? await flattenRowsChunked(data.rows, options, totalRows, onProgress)
        : flattenRows(data.rows, options);
    const useFormatted = options.useFormattedValues !== false;
    const lines = [...headerRows, ...bodyRows];
    if (data.grandTotal) {
        lines.push(data.grandTotal.cells.map((cell) => cellDisplayValue(cell, useFormatted)));
    }
    onProgress?.({ phase: "writing", processedRows: totalRows, totalRows });
    await yieldToMain();
    const worksheet = XLSX.utils.aoa_to_sheet(lines);
    if (merges.length > 0) {
        worksheet["!merges"] = merges;
    }
    const workbook = XLSX.utils.book_new();
    const sheetName = (options.sheetName ?? DEFAULT_SHEET).replace(/[:\\/?*[\]]/g, "_").slice(0, 31) ||
        DEFAULT_SHEET;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const filename = options.filename ?? DEFAULT_FILENAME;
    const output = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, output, { bookType: "xlsx", compression: true });
    onProgress?.({ phase: "done", processedRows: totalRows, totalRows });
}

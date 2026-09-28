import * as XLSX from "xlsx";
import type {
  PivotCell,
  PivotConfig,
  PivotData,
  PivotField,
  PivotHeader,
  PivotRow,
  PivotTotalRow
} from "@salec/pivot-engine";
import { resolveLayoutForm } from "@/lib/pivot-layout-form";
import {
  blankRepeatedParentLabels,
  flattenPivotRowsLocal,
  splitPivotRowPath,
  type LocalFlatPivotRowItem
} from "@/lib/pivot-flatten";

export type ScreenPivotExportOptions = {
  expandedRows?: Set<string>;
  useFormattedValues?: boolean;
  /**
   * true (default) — export uchun butun daraxt ochiq (to‘liq hisobot).
   * false — faqat `expandedRows` (ekrandagi expand bilan bir xil).
   */
  expandAllForExport?: boolean;
};

/** PivotRow.tsx resolveClassicLabels — React-siz nusxa (export/test uchun). */
export function resolveClassicLabelsForExport(
  pathLabels: string[] | undefined,
  row: PivotRow,
  depth: number,
  rowFieldCount: number
): string[] {
  const fromKey = splitPivotRowPath(row.key);
  const labelCell = row.cells.find((c) => c.columnKey === "__row_label__") ?? row.cells[0];
  const self = String(
    labelCell?.formatted ?? labelCell?.value ?? fromKey[fromKey.length - 1] ?? row.key
  );

  return Array.from({ length: rowFieldCount }, (_, i) => {
    const fromPath = pathLabels?.[i];
    if (fromPath != null && String(fromPath).trim() !== "") return String(fromPath);
    const keyPart = fromKey[i];
    if (keyPart != null && String(keyPart).trim() !== "") return String(keyPart);
    if (i === depth) return self;
    return "";
  });
}

function cellDisplay(cell: PivotCell, useFormatted: boolean): string | number {
  if (useFormatted) {
    return cell.formatted || (cell.value == null ? "" : String(cell.value));
  }
  if (cell.rawValue != null && Number.isFinite(cell.rawValue)) return cell.rawValue;
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) return cell.value;
  return cell.formatted || (cell.value == null ? "" : String(cell.value));
}

function valueCellsOf(cells: PivotCell[]): PivotCell[] {
  const hasLabel = cells.some((c) => c.columnKey === "__row_label__");
  return hasLabel ? cells.filter((c) => c.columnKey !== "__row_label__") : cells;
}

function labelTextOf(cells: PivotCell[]): string {
  const label = cells.find((c) => c.columnKey === "__row_label__");
  return String(label?.formatted ?? label?.value ?? "");
}

/** Итого / subtotal: birinchi row-dim ustunga yorliq, qolganlari bo‘sh (TSV/UI bilan). */
function totalLine(
  cells: PivotCell[],
  rowDimCount: number,
  useFormatted: boolean
): (string | number)[] {
  const values = valueCellsOf(cells).map((c) => cellDisplay(c, useFormatted));
  if (rowDimCount <= 0) return values;
  const label = labelTextOf(cells);
  const dims = Array.from({ length: rowDimCount }, (_, i) => (i === 0 ? label : ""));
  return [...dims, ...values];
}

function collectAllRowKeys(rows: PivotRow[], out: Set<string>) {
  for (const row of rows) {
    out.add(row.key);
    if (row.children?.length) collectAllRowKeys(row.children, out);
  }
}

function resolveExpanded(
  data: PivotData,
  options: ScreenPivotExportOptions
): Set<string> {
  if (options.expandAllForExport === false && options.expandedRows) {
    return options.expandedRows;
  }
  const s = new Set<string>();
  collectAllRowKeys(data.rows, s);
  return s;
}

function buildValueHeaderRows(data: PivotData, rowDimCount: number): string[][] {
  const headerLevels = data.headers.length;
  if (headerLevels === 0) {
    return [Array.from({ length: Math.max(rowDimCount, 1) }, () => "")];
  }

  const lastLevel = data.headers[headerLevels - 1] ?? [];
  const dataCols = lastLevel
    .filter((h) => h.key !== "__row_label__")
    .reduce((sum, h) => sum + h.colspan, 0);
  const totalCols = rowDimCount + dataCols;

  const matrix: string[][] = Array.from({ length: headerLevels }, () =>
    Array.from({ length: totalCols }, () => "")
  );

  for (let levelIdx = 0; levelIdx < headerLevels; levelIdx++) {
    const level = data.headers[levelIdx] ?? [];
    let col = rowDimCount;
    for (const header of level) {
      if (header.key === "__row_label__") continue;
      matrix[levelIdx]![col] = header.label;
      col += header.colspan;
    }
  }

  return matrix;
}

function appendFlatItem(
  lines: (string | number)[][],
  item: LocalFlatPivotRowItem,
  ctx: {
    mode: "classic" | "compact";
    rowFieldCount: number;
    useFormatted: boolean;
    prevFull: string[] | null;
    setPrevFull: (v: string[] | null) => void;
  }
) {
  if (item.type === "row") {
    const full = resolveClassicLabelsForExport(
      item.pathLabels,
      item.row,
      item.depth,
      ctx.rowFieldCount
    );
    const labels =
      ctx.mode === "classic" ? blankRepeatedParentLabels(full, ctx.prevFull) : full;
    ctx.setPrevFull(full);
    const values = valueCellsOf(item.row.cells).map((c) => cellDisplay(c, ctx.useFormatted));
    lines.push([...labels, ...values]);
    return;
  }

  if (item.type === "subtotal") {
    lines.push(totalLine(item.subtotal.cells, ctx.rowFieldCount, ctx.useFormatted));
    ctx.setPrevFull(null);
    return;
  }

  if (item.type === "columnTotal" || item.type === "grandTotal") {
    lines.push(totalLine(item.total.cells, ctx.rowFieldCount, ctx.useFormatted));
    ctx.setPrevFull(null);
  }
}

/**
 * Ekrandagi PivotTable bilan bir xil AoA:
 * - flat: ustunlar = field headers
 * - classic/compact (rows>1): har row field alohida ustun («Группа» emas)
 * - classic: takroriy ota yorliqlari blank
 */
export function buildScreenMatchingPivotAoA(
  data: PivotData,
  config: PivotConfig,
  fields: PivotField[],
  options: ScreenPivotExportOptions = {}
): (string | number)[][] {
  const useFormatted = options.useFormattedValues !== false;
  const layout = resolveLayoutForm(config.options);
  const fieldLabel = (id: string) => fields.find((f) => f.id === id)?.label ?? id;

  // Flat — engine allaqachon multi-column (yoki __row_label__ yo‘q)
  if (layout === "flat" || !data.rows.some((r) => r.cells.some((c) => c.columnKey === "__row_label__"))) {
    const headerRows = data.headers.map((level) => level.map((h) => h.label));
    const body = data.rows.map((row) =>
      row.cells.map((c) => cellDisplay(c, useFormatted))
    );
    const lines: (string | number)[][] = [...headerRows, ...body];
    if (data.columnTotals) {
      lines.push(data.columnTotals.cells.map((c) => cellDisplay(c, useFormatted)));
    }
    if (data.grandTotal) {
      lines.push(data.grandTotal.cells.map((c) => cellDisplay(c, useFormatted)));
    }
    return lines;
  }

  const rowFieldCount = Math.max(1, config.rows.length);
  const useRowDims = (layout === "classic" || layout === "compact") && config.rows.length > 1;
  const rowDimCount = useRowDims ? config.rows.length : 1;
  const mode: "classic" | "compact" = layout === "classic" ? "classic" : "compact";

  const rowLabels = useRowDims
    ? config.rows.map(fieldLabel)
    : [fieldLabel(config.rows[0] ?? "Группа")];

  const valueHeader = buildValueHeaderRows(data, rowDimCount);
  for (let i = 0; i < rowDimCount; i++) {
    if (valueHeader[0]) valueHeader[0]![i] = rowLabels[i] ?? "";
    for (let level = 1; level < valueHeader.length; level++) {
      if (valueHeader[level]) valueHeader[level]![i] = "";
    }
  }

  const expanded = resolveExpanded(data, options);
  const flat = flattenPivotRowsLocal(
    data.rows,
    expanded,
    data.grandTotal,
    data.columnTotals,
    mode,
    useRowDims ? rowFieldCount : 1
  );

  const lines: (string | number)[][] = [...valueHeader];
  let prevFull: string[] | null = null;

  for (const item of flat) {
    if (!useRowDims) {
      // Bitta row field — indentatsiyasiz bitta label ustun
      if (item.type === "row") {
        const text = resolveClassicLabelsForExport(
          item.pathLabels,
          item.row,
          item.depth,
          1
        )[0] ?? "";
        const values = valueCellsOf(item.row.cells).map((c) => cellDisplay(c, useFormatted));
        lines.push([text, ...values]);
      } else if (item.type === "subtotal") {
        lines.push(totalLine(item.subtotal.cells, 1, useFormatted));
      } else {
        lines.push(totalLine(item.total.cells, 1, useFormatted));
      }
      continue;
    }

    appendFlatItem(lines, item, {
      mode,
      rowFieldCount,
      useFormatted,
      prevFull,
      setPrevFull: (v) => {
        prevFull = v;
      }
    });
  }

  return lines;
}

/** PDF/HTML engine export uchun — AoA dan tekis PivotData (daraxt yo‘q). */
export function aoaToFlatPivotData(
  aoa: (string | number)[][],
  meta?: Partial<PivotData["metadata"]>
): PivotData {
  const headerRow = aoa[0] ?? [];
  const headers: PivotHeader[] = headerRow.map((label, i) => ({
    key: `c${i}`,
    label: String(label ?? ""),
    colspan: 1,
    rowspan: 1,
    depth: 0,
    isValue: true
  }));

  const body = aoa.slice(1);
  const rows: PivotRow[] = body.map((line, ri) => ({
    key: `export-row-${ri}`,
    depth: 0,
    cells: line.map((v, i) => ({
      value: v,
      rawValue: typeof v === "number" && Number.isFinite(v) ? v : null,
      formatted: v == null ? "" : String(v),
      columnKey: `c${i}`,
      isEmpty: v === "" || v == null
    }))
  }));

  return {
    headers: headers.length ? [headers] : [],
    rows,
    metadata: {
      totalRows: rows.length,
      processedRows: rows.length,
      executionTime: 0,
      warnings: [],
      ...meta
    }
  };
}

export function writePivotAoAToExcel(
  aoa: (string | number)[][],
  options: { filename?: string; sheetName?: string } = {}
): void {
  const numericAoA = aoa.map((row) =>
    row.map((cell) => {
      if (typeof cell === "number" && Number.isFinite(cell)) return cell;
      if (typeof cell !== "string") return cell;
      const trimmed = cell.trim();
      if (!trimmed) return cell;
      // "550 000" / "1 234,56" → number (Excel qiymat formati)
      if (/[a-zA-Zа-яА-Я]/.test(trimmed)) return cell;
      const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
      if (!/^-?\d+(\.\d+)?$/.test(normalized)) return cell;
      const n = Number(normalized);
      return Number.isFinite(n) ? n : cell;
    })
  );
  const worksheet = XLSX.utils.aoa_to_sheet(numericAoA);
  const workbook = XLSX.utils.book_new();
  const sheetName =
    (options.sheetName ?? "Pivot").replace(/[:\\/?*[\]]/g, "_").slice(0, 31) || "Pivot";
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const filename = options.filename ?? "pivot-export.xlsx";
  const output = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, output, { bookType: "xlsx", compression: true });
}

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadPivotAoAAsCsv(
  aoa: (string | number)[][],
  filename = "pivot-export.csv"
): void {
  const lines = aoa.map((row) => row.map(escapeCsvCell).join(","));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Test/helper: total qatorini row-dim bilan yig‘ish. */
export function buildTotalExportLine(
  total: PivotTotalRow,
  rowDimCount: number,
  useFormatted = true
): (string | number)[] {
  return totalLine(total.cells, rowDimCount, useFormatted);
}

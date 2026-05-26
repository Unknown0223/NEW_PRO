"use client";

/**
 * Excel shablon — `zakazlar_detalniy_*.xlsx` namunasiga mos:
 * ko‘k sarlavha, oq qalin matn, markazlashtirish, 1-qator qotirilgan, zebra qatorlar.
 */

type XlsxFill = {
  type: "pattern";
  pattern: "solid";
  fgColor: { argb: string };
};

const FILL_HEADER: XlsxFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF002060" }
};

const FILL_ROW_ALT: XlsxFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" }
};

/** Bonus tovar qatori (UI bilan uyg‘un) */
const FILL_BONUS_ROW: XlsxFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8F5F3" }
};

export type StyledXlsxRowMeta = {
  /** Zebra o‘rniga bonus fon */
  isBonusRow?: boolean;
};

export type DownloadStyledXlsxOptions = {
  colWidths?: number[];
  /** Har bir ma’lumot qatori uchun (header dan keyin, 0-indeks) */
  rowMeta?: StyledXlsxRowMeta[];
};

function normalizeCell(cell: string | number | boolean | null | undefined): string | number | boolean {
  if (cell == null) return "";
  if (typeof cell === "boolean") return cell ? "1" : "0";
  if (typeof cell === "number") return cell;
  return String(cell).normalize("NFC");
}

function triggerBrowserDownload(buffer: ArrayBuffer, filename: string): void {
  const out = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = out;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function estimateColWidth(headers: string[], rows: (string | number | boolean)[][]): number[] {
  const n = headers.length;
  const widths = headers.map((h) => Math.min(Math.max(h.length * 1.15 + 2, 8), 42));
  for (const line of rows) {
    for (let i = 0; i < n; i++) {
      const len = String(line[i] ?? "").length;
      widths[i] = Math.min(Math.max(widths[i]!, len * 1.1 + 2), 42);
    }
  }
  return widths;
}

type ExcelJS = typeof import("exceljs");

export async function downloadStyledXlsxSheet(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  options?: DownloadStyledXlsxOptions
): Promise<void> {
  const ExcelJSMod = (await import("exceljs")) as { default: ExcelJS };
  const ExcelJS = ExcelJSMod.default;

  const safeName = sheetName.replace(/[:\\/?*[\]]/g, "_").slice(0, 31) || "Sheet1";
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(safeName, {
    views: [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }],
    properties: { defaultRowHeight: 15.75 }
  });

  const headerRow = ws.getRow(1);
  headerRow.height = 25.5;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = normalizeCell(h);
    cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.fill = FILL_HEADER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const normalizedRows = rows.map((line) => line.map((cell) => normalizeCell(cell)));

  normalizedRows.forEach((line, idx) => {
    const row = ws.getRow(idx + 2);
    const meta = options?.rowMeta?.[idx];
    const isAlt = idx % 2 === 1;
    const fill = meta?.isBonusRow ? FILL_BONUS_ROW : isAlt ? FILL_ROW_ALT : undefined;

    line.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      const empty = val === "";
      cell.value = empty ? null : val;
      cell.font = { size: 12, name: "Calibri" };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      if (fill) cell.fill = fill;
    });
  });

  const widths = options?.colWidths?.length
    ? options.colWidths.map((wch) => Math.min(Math.max(wch, 6), 60))
    : estimateColWidth(headers, normalizedRows);

  widths.forEach((wch, i) => {
    ws.getColumn(i + 1).width = wch;
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerBrowserDownload(buffer as ArrayBuffer, filename);
}

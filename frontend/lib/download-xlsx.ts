export type DownloadXlsxMerge = {
  /** 0-based inclusive range */
  s: { r: number; c: number };
  e: { r: number; c: number };
};

export type DownloadXlsxOptions = {
  /** Ustun kengligi (belgilar taxmini, Excel `wch`) */
  colWidths?: number[];
  /** Qo‘shimcha header qatorlari (birinchi `headers` o‘rniga to‘liq AOA berilganda ishlatiladi) */
  merges?: DownloadXlsxMerge[];
};

function normalizeCell(cell: string | number | boolean | null | undefined): string | number | boolean {
  if (cell == null) return "";
  if (typeof cell === "boolean") return cell ? "1" : "0";
  if (typeof cell === "number") return cell;
  return String(cell).normalize("NFC");
}

/**
 * Excel (.xlsx) — OOXML ichida UTF-8; o‘zbek/kirill matnlari Excelda to‘g‘ri ochiladi.
 * Matnlar Unicode NFC normalizatsiyasidan o‘tadi.
 * `xlsx` paketi faqat chaqirilganda yuklanadi (bosh sahifa bundle kichrayadi).
 */
export async function downloadXlsxSheet(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  options?: DownloadXlsxOptions
): Promise<void> {
  return downloadXlsxAoa(
    filename,
    sheetName,
    [headers, ...rows],
    options
  );
}

/** To‘liq AOA (bir nechta header qatori + merges) bilan .xlsx. */
export async function downloadXlsxAoa(
  filename: string,
  sheetName: string,
  aoaInput: (string | number | boolean | null | undefined)[][],
  options?: DownloadXlsxOptions
): Promise<void> {
  const safeName = sheetName.replace(/[:\\/?*[\]]/g, "_").slice(0, 31) || "Sheet1";
  const aoa: (string | number | boolean)[][] = aoaInput.map((line) =>
    line.map((cell) => normalizeCell(cell))
  );
  const XLSX = await import("xlsx").catch(() => null);
  if (!XLSX) {
    throw new Error("XLSX_CHUNK_LOAD_FAILED");
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (options?.colWidths?.length) {
    ws["!cols"] = options.colWidths.map((wch) => ({ wch: Math.min(Math.max(wch, 6), 60) }));
  }
  if (options?.merges?.length) {
    ws["!merges"] = options.merges.map((m) => ({ s: m.s, e: m.e }));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeName);
  const out = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out, { bookType: "xlsx", compression: true });
}

export type DownloadXlsxSheetSpec = {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
} & DownloadXlsxOptions;

/**
 * Bir nechta varaqli .xlsx (masalan «Общий» + «Подробно»).
 */
export async function downloadXlsxWorkbook(filename: string, sheets: DownloadXlsxSheetSpec[]): Promise<void> {
  const XLSX = await import("xlsx").catch(() => null);
  if (!XLSX) {
    throw new Error("XLSX_CHUNK_LOAD_FAILED");
  }
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const safeName = sh.name.replace(/[:\\/?*[\]]/g, "_").slice(0, 31) || "Sheet1";
    const aoa: (string | number | boolean)[][] = [
      sh.headers.map((h) => normalizeCell(h) as string),
      ...sh.rows.map((line) => line.map((cell) => normalizeCell(cell)))
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (sh.colWidths?.length) {
      ws["!cols"] = sh.colWidths.map((wch) => ({ wch: Math.min(Math.max(wch, 6), 60) }));
    }
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  const out = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out, { bookType: "xlsx", compression: true });
}

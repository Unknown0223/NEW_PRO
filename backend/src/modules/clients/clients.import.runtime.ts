import * as XLSX from "xlsx";
import { excelHeaderToImportKey, normalizeHeaderLabel } from "./clients.import.keys";
import { headerLabelFromCell } from "./clients.import.parse";

export const IMPORT_MAX_ERRORS_RETURNED = 100;
export const IMPORT_MAX_WARNINGS_RETURNED = 120;
export const IMPORT_PROGRESS_STEP_ROWS = 75;
export const IMPORT_PROGRESS_CHUNK_ROWS = 1000;
export const IMPORT_HEADER_SCAN_ROWS = 50;
export const IMPORT_MAX_DATA_ROWS = 200_000;
/** PostgreSQL prepared statement: `IN (...)` uchun xavfsiz paket (limit 32767). */
export const IMPORT_ID_LOOKUP_CHUNK = 5000;

export function chunkNumericIds(ids: readonly number[], chunkSize = IMPORT_ID_LOOKUP_CHUNK): number[][] {
  if (ids.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(ids.slice(i, i + chunkSize) as number[]);
  }
  return out;
}

/** Prisma/PostgreSQL texnik xabarlarini import UI uchun qisqartirish. */
export function humanizeImportDbError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Import xatosi";
  if (/too many bind variables/i.test(raw) || /expected maximum of 32767/i.test(raw)) {
    return (
      "Ma’lumotlar bazasi so‘rovi juda katta (PostgreSQL bind limiti). " +
      "Backend worker qayta ishga tushirilganini tekshiring va importni qayta urinib ko‘ring."
    );
  }
  if (/Invalid `prisma\./i.test(raw)) {
    const assertion = raw
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /Assertion violation|too many bind variables/i.test(l));
    if (assertion) return humanizeImportDbError(assertion);
    return "Ma’lumotlar bazasida import vaqtida xato. Faylni kichikroq qilib qayta urinib ko‘ring.";
  }
  return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
}

export type ClientImportProgressStage =
  | "queued"
  | "parsing"
  | "resolving"
  | "writing"
  | "finalizing"
  | "done"
  | "failed";

export type ClientImportProgress = {
  stage: ClientImportProgressStage;
  percent: number;
  processedRows: number;
  totalRows: number;
  message?: string;
};

export type ClientImportProgressSink = (progress: ClientImportProgress) => void | Promise<void>;

export function buildColIndexFromHeaderRow(headerCells: unknown): Record<string, number> | null {
  if (!Array.isArray(headerCells)) return null;
  const colIndexByKey: Record<string, number> = {};
  headerCells.forEach((cell, idx) => {
    const label = headerLabelFromCell(cell);
    if (!label) return;
    const key = excelHeaderToImportKey(label);
    if (key) colIndexByKey[key] = idx;
  });
  const hasName = Object.prototype.hasOwnProperty.call(colIndexByKey, "name");
  const hasDbId = Object.prototype.hasOwnProperty.call(colIndexByKey, "client_db_id");
  return hasName || hasDbId ? colIndexByKey : null;
}

function isPotentialAssignmentHeaderLabel(label: string): boolean {
  const n = normalizeHeaderLabel(label);
  if (!n) return false;
  if (!/\d/.test(n)) return false;
  return n.includes("агент") || n.includes("экспедитор");
}

export function collectUnknownAssignmentHeaders(headerCells: unknown): string[] {
  if (!Array.isArray(headerCells)) return [];
  const out: string[] = [];
  for (const cell of headerCells) {
    const label = headerLabelFromCell(cell);
    if (!label) continue;
    if (!isPotentialAssignmentHeaderLabel(label)) continue;
    const key = excelHeaderToImportKey(label);
    if (!key) out.push(label);
  }
  return out;
}

export type ImportWarningCollector = {
  push: (message: string) => void;
  list: string[];
};

export function createImportWarningCollector(limit = IMPORT_MAX_WARNINGS_RETURNED): ImportWarningCollector {
  const list: string[] = [];
  const seen = new Set<string>();
  return {
    list,
    push(message: string) {
      const msg = message.trim();
      if (!msg || seen.has(msg)) return;
      seen.add(msg);
      if (list.length < limit) list.push(msg);
    }
  };
}

function normalizeProgressPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export async function emitClientImportProgress(
  sink: ClientImportProgressSink | undefined,
  progress: ClientImportProgress
) {
  if (!sink) return;
  await sink({
    ...progress,
    percent: normalizeProgressPercent(progress.percent),
    processedRows: Math.max(0, Math.floor(progress.processedRows)),
    totalRows: Math.max(0, Math.floor(progress.totalRows))
  });
}

export function sheetToRowsMatrix(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true
  }) as unknown[][];
}

/** Bir nechta varaq va sarlavha offsetini qo‘llab-quvvatlaydi; eng ko‘p ma’lumot qatori bo‘lgan blokni tanlaydi. */
export function findImportTableInWorkbook(wb: XLSX.WorkBook): {
  sheetName: string;
  rows: unknown[][];
  headerRowIdx: number;
  colIndexByKey: Record<string, number>;
} | null {
  let best: {
    sheetName: string;
    rows: unknown[][];
    headerRowIdx: number;
    colIndexByKey: Record<string, number>;
    dataRows: number;
  } | null = null;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = sheetToRowsMatrix(ws);
    if (rows.length === 0) continue;

    const scanLimit = Math.min(IMPORT_HEADER_SCAN_ROWS, rows.length);
    for (let hr = 0; hr < scanLimit; hr++) {
      const colIndexByKey = buildColIndexFromHeaderRow(rows[hr]);
      if (!colIndexByKey) continue;
      const dataRows = rows.length - hr - 1;
      if (
        best == null ||
        dataRows > best.dataRows ||
        (dataRows === best.dataRows && rows.length > best.rows.length)
      ) {
        best = { sheetName, rows, headerRowIdx: hr, colIndexByKey, dataRows };
      }
    }
  }

  if (!best) return null;
  return {
    sheetName: best.sheetName,
    rows: best.rows,
    headerRowIdx: best.headerRowIdx,
    colIndexByKey: best.colIndexByKey
  };
}

export type ClientXlsxImportOptions = {
  /** Varaq nomi (bo‘sh bo‘lsa — birinchi varaq). */
  sheetName?: string;
  /** Sarlavha qatori, 0-indeks (Excelda 1-qator = 0). */
  headerRowIndex?: number;
  /** Tizim maydoni → fayldagi ustun indeksi (0 dan). */
  columnMap?: Record<string, number>;
  /**
   * UI rejimi: `create` bo‘lsa `client_db_id` ustuni e’tiborsiz (faqat yangi yozuvlar).
   * Berilmasa — avvalgidek: xaritada `client_db_id` bo‘lsa «yangilash» rejimi.
   */
  importMode?: "create" | "update";
  /**
   * Yangi klient: dublikat qaysi maydonlar bo‘yicha (`client_code`, `city`, `phone`, …).
   * Bo‘sh massiv yoki berilmasa — dublikat tekshiruvi o‘tkazilmaydi.
   */
  duplicateKeyFields?: string[];
  /**
   * Yangilash: faqat bu import kalitlari Exceldan qo‘llanadi. `undefined`/bo‘sh — barcha xaritalangan ustunlar.
   */
  updateApplyFields?: string[];
  onProgress?: ClientImportProgressSink;
  /** Import aktori (yo‘q bo‘lsa audit null-safe). */
  actorUserId?: number | null;
};

/** Import tugagach job/API javobida qatorlar bo‘yicha aniq hisob (UI «N / M» uchun). */
export type ClientImportFinalStats = {
  totalRows: number;
  processedRows: number;
  skippedDuplicate: number;
  skippedEmpty: number;
  /** Yangilash: Excel bazadagi qiymat bilan bir xil (o‘zgarish yozilmagan). */
  unchangedRows?: number;
};

export type ClientXlsxImportResult = {
  created: number;
  /** «Обновление с Excel»: `ИД` ustuni bo‘lsa */
  updated: number;
  errors: string[];
  importStats?: ClientImportFinalStats;
};

export type ImportFlowContext = {
  warnings: ImportWarningCollector;
  progressSink?: ClientImportProgressSink;
  totalRows: number;
  processedRows: number;
  parseMs: number;
  resolveMs: number;
  writeMs: number;
  actorUserId?: number | null;
};

export async function reportImportRowProgress(
  ctx: ImportFlowContext,
  stage: ClientImportProgressStage,
  force = false
) {
  if (!ctx.progressSink) return;
  const stepHit = force || ctx.processedRows % IMPORT_PROGRESS_STEP_ROWS === 0;
  const chunkHit =
    ctx.totalRows > 0 &&
    ctx.processedRows > 0 &&
    (ctx.processedRows % IMPORT_PROGRESS_CHUNK_ROWS === 0 || ctx.processedRows === ctx.totalRows);
  if (!stepHit && !chunkHit) return;
  const percent = ctx.totalRows > 0 ? (ctx.processedRows / ctx.totalRows) * 100 : 100;
  let message: string | undefined;
  if (chunkHit && ctx.totalRows > 0) {
    const nChunks = Math.ceil(ctx.totalRows / IMPORT_PROGRESS_CHUNK_ROWS);
    const cur = Math.min(nChunks, Math.ceil(ctx.processedRows / IMPORT_PROGRESS_CHUNK_ROWS));
    message = `Пачка ${cur} / ${nChunks} (по ${IMPORT_PROGRESS_CHUNK_ROWS} строк)`;
  }
  const p = emitClientImportProgress(ctx.progressSink, {
    stage,
    percent,
    processedRows: ctx.processedRows,
    totalRows: ctx.totalRows,
    message
  });
  if (force) await p;
}

export function estimateImportTotalRows(rows: unknown[][], headerRowIdx: number): number {
  const firstDataRow = headerRowIdx + 1;
  const lastRowIdx = Math.min(rows.length - 1, headerRowIdx + IMPORT_MAX_DATA_ROWS);
  if (firstDataRow > rows.length - 1) return 0;
  return Math.max(0, lastRowIdx - firstDataRow + 1);
}

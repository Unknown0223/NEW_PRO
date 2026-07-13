/** Excel (va ixtiyoriy CSV) fayl tanlash / drag-drop yordamchilari */

const EXCEL_EXT = /\.(xlsx|xls|xlsm)$/i;
const EXCEL_OR_CSV_EXT = /\.(xlsx|xls|xlsm|csv)$/i;

const EXCEL_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "text/csv",
  "application/csv"
]);

export type ExcelPickOptions = {
  /** Default: false — faqat xlsx/xls/xlsm */
  allowCsv?: boolean;
};

export function isExcelLikeFile(file: File, opts: ExcelPickOptions = {}): boolean {
  const re = opts.allowCsv ? EXCEL_OR_CSV_EXT : EXCEL_EXT;
  if (re.test(file.name)) return true;
  const mime = (file.type || "").toLowerCase();
  if (!mime) return false;
  if (opts.allowCsv && (mime === "text/csv" || mime === "application/csv")) return true;
  return EXCEL_MIME.has(mime) && !(mime.startsWith("text/") && !opts.allowCsv);
}

export function pickFirstExcelFile(
  files: FileList | File[] | null | undefined,
  opts: ExcelPickOptions = {}
): File | null {
  if (!files || files.length === 0) return null;
  const list = Array.from(files);
  return list.find((f) => isExcelLikeFile(f, opts)) ?? null;
}

export const EXCEL_ACCEPT =
  ".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export const EXCEL_OR_CSV_ACCEPT =
  ".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

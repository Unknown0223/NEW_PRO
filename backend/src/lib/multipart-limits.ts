import { env } from "../config/env";

export class ExcelImportTooLargeError extends Error {
  readonly code = "EXCEL_IMPORT_TOO_LARGE";

  constructor() {
    super(
      `Excel fayl hajmi ${Math.round(env.MULTIPART_EXCEL_MAX_BYTES / (1024 * 1024))} MB dan oshmasligi kerak`
    );
    this.name = "ExcelImportTooLargeError";
  }
}

export function assertExcelImportSize(bytes: number): void {
  if (bytes > env.MULTIPART_EXCEL_MAX_BYTES) {
    throw new ExcelImportTooLargeError();
  }
}

export function excelImportLimitMb(): number {
  return Math.round(env.MULTIPART_EXCEL_MAX_BYTES / (1024 * 1024));
}

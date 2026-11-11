import { env } from "../config/env";
import { assertFileKind } from "./file-signature.pure";

export class ExcelImportTooLargeError extends Error {
  readonly code = "EXCEL_IMPORT_TOO_LARGE";

  constructor() {
    super(
      `Размер файла Excel не должен превышать ${Math.round(env.MULTIPART_EXCEL_MAX_BYTES / (1024 * 1024))} МБ`
    );
    this.name = "ExcelImportTooLargeError";
  }
}

export function assertExcelImportSize(bytes: number): void {
  if (bytes > env.MULTIPART_EXCEL_MAX_BYTES) {
    throw new ExcelImportTooLargeError();
  }
}

export class ExcelImportBadTypeError extends Error {
  readonly code = "EXCEL_IMPORT_BAD_TYPE";

  constructor() {
    super("Файл должен быть .xlsx. В Excel выберите «Сохранить как» → .xlsx.");
    this.name = "ExcelImportBadTypeError";
  }
}

/** Hajm + .xlsx (ZIP) magic. */
export function assertExcelImportBuffer(buf: Buffer): void {
  assertExcelImportSize(buf.length);
  try {
    assertFileKind(buf, ["zip"]);
  } catch {
    throw new ExcelImportBadTypeError();
  }
}

export function excelImportLimitMb(): number {
  return Math.round(env.MULTIPART_EXCEL_MAX_BYTES / (1024 * 1024));
}

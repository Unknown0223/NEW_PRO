import type ExcelJS from "exceljs";

type SheetModel = ExcelJS.WorksheetModel & {
  merges?: string[];
  mergeCells?: string[];
  media?: unknown[];
  tables?: unknown[];
};

/** Shablon varag‘ini (qiymat + uslub + merge + sahifa sozlamasi) boshqa workbookka ko‘chirish. */
export function copyWorksheetInto(
  out: ExcelJS.Workbook,
  src: ExcelJS.Worksheet,
  name: string
): ExcelJS.Worksheet {
  const dest = out.addWorksheet(name);
  const model = src.model as SheetModel;
  (dest as ExcelJS.Worksheet & { model: SheetModel }).model = {
    ...model,
    id: dest.id,
    name,
    media: [],
    tables: [],
    mergeCells: model.merges ?? []
  };
  return dest;
}

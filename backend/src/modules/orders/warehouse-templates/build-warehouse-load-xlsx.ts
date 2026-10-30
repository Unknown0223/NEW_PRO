import ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx.types";
import type { WarehouseLayoutId } from "./warehouse-template-ids";
import { getWarehouseLayoutDef } from "./warehouse-template-ids";
import { loadWarehouseTemplateWorkbook } from "./warehouse-template-assets";
import { buildWarehouseAggregateContext } from "./warehouse-template-shared";
import { fillWarehouseTemplate } from "./warehouse-template-fill";
import { removeEmptyWorksheets } from "./warehouse-template-sanitize";
import { repairWorkbookBeforeWrite } from "./warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-template-zip-patch";
import {
  numberedSheetName,
  singleSheetOptions,
  splitOrdersIntoSheetGroups,
  uniqueSheetName
} from "./nakladnoy-sheet-groups";
import { copyWorksheetInto } from "./warehouse-template-sheet-copy";

async function fillWarehouseWorkbook(
  layoutId: WarehouseLayoutId,
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<ExcelJS.Workbook> {
  const wb = await loadWarehouseTemplateWorkbook(layoutId);
  const ctx = buildWarehouseAggregateContext(orders, options);
  fillWarehouseTemplate(layoutId, wb, ctx, options);
  removeEmptyWorksheets(wb);
  return wb;
}

async function writeWorkbook(wb: ExcelJS.Workbook): Promise<Buffer> {
  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}

export async function buildWarehouseLoadXlsx(
  layoutId: WarehouseLayoutId,
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  if (orders.length === 0) {
    throw new Error("EMPTY_ORDER_IDS");
  }
  if (!options.separateSheets) {
    return writeWorkbook(await fillWarehouseWorkbook(layoutId, orders, options));
  }

  const code = getWarehouseLayoutDef(layoutId).fileCode;
  const out = new ExcelJS.Workbook();
  out.creator = "SALESDOC";
  const used = new Set<string>();
  const groups = splitOrdersIntoSheetGroups(orders, options);
  for (const [i, group] of groups.entries()) {
    const wb = await fillWarehouseWorkbook(layoutId, group.orders, singleSheetOptions(options));
    wb.worksheets
      .filter((ws) => ws.state !== "hidden")
      .forEach((sheet, k) => {
        const label = k === 0 ? group.label : `${group.label} ${k + 1}`;
        copyWorksheetInto(out, sheet, uniqueSheetName(used, numberedSheetName(i + 1, code, label)));
      });
  }
  return writeWorkbook(out);
}

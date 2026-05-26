import { readFileSync, existsSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import type { WarehouseLayoutId } from "./warehouse-template-ids";
import { getWarehouseLayoutDef } from "./warehouse-template-ids";
import { repairWorkbookAfterExcelJsLoad } from "./warehouse-template-repair";

const ASSET_DIR = join(__dirname, "../../../../assets/nakladnoy/warehouse");

export function warehouseTemplateAssetPath(layoutId: WarehouseLayoutId): string {
  const def = getWarehouseLayoutDef(layoutId);
  return join(ASSET_DIR, def.assetFile);
}

export function readWarehouseTemplateBytes(layoutId: WarehouseLayoutId): Buffer {
  const p = warehouseTemplateAssetPath(layoutId);
  if (!existsSync(p)) {
    throw new Error(`WAREHOUSE_TEMPLATE_ASSET_MISSING:${layoutId}`);
  }
  return readFileSync(p);
}

export async function loadWarehouseTemplateWorkbook(
  layoutId: WarehouseLayoutId
): Promise<ExcelJS.Workbook> {
  const buf = readWarehouseTemplateBytes(layoutId);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  repairWorkbookAfterExcelJsLoad(wb);
  return wb;
}

/** Birinchi ma’lumotli varaq (bo‘sh «Worksheet» dan o‘tadi). */
export function primaryDataSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  for (const ws of wb.worksheets) {
    if (ws.rowCount > 0 && ws.columnCount > 0) return ws;
  }
  return wb.worksheets[0]!;
}

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import type { ExpeditorLoadingLayoutId } from "./expeditor-loading-template-ids";
import { getExpeditorLoadingLayoutDef } from "./expeditor-loading-template-ids";
import { preprocessExpeditorTemplateBuffer } from "./expeditor-template-preprocess";
import { repairWorkbookAfterExcelJsLoad } from "./warehouse-template-repair";

const ASSET_DIR = join(__dirname, "../../../../assets/nakladnoy/loading");

export function expeditorLoadingAssetPath(layoutId: ExpeditorLoadingLayoutId): string {
  const def = getExpeditorLoadingLayoutDef(layoutId);
  return join(ASSET_DIR, def.assetFile);
}

export async function loadExpeditorLoadingTemplateWorkbook(
  layoutId: ExpeditorLoadingLayoutId
): Promise<ExcelJS.Workbook> {
  const p = expeditorLoadingAssetPath(layoutId);
  if (!existsSync(p)) {
    throw new Error(`EXPEDITOR_LOADING_TEMPLATE_ASSET_MISSING:${layoutId}`);
  }
  const raw = readFileSync(p);
  const prepped = await preprocessExpeditorTemplateBuffer(raw);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(prepped as never);
  repairWorkbookAfterExcelJsLoad(wb);
  return wb;
}

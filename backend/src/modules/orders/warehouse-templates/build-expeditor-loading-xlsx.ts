import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx.types";
import type { ExpeditorLoadingLayoutId } from "./expeditor-loading-template-ids";
import { getExpeditorLoadingLayoutDef } from "./expeditor-loading-template-ids";
import { loadExpeditorLoadingTemplateWorkbook } from "./expeditor-loading-template-assets";
import { buildWarehouseAggregateContext } from "./warehouse-template-shared";
import { fillExpeditorLoading518 } from "./fill/fill-expeditor-loading-518";
import { fillExpeditorLoading520 } from "./fill/fill-expeditor-loading-520";
import { removeEmptyWorksheets, trimTrailingEmptyRows } from "./warehouse-template-sanitize";
import { repairWorkbookBeforeWrite } from "./warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-template-zip-patch";

export async function buildExpeditorLoadingXlsx(
  layoutId: ExpeditorLoadingLayoutId,
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  if (orders.length === 0) {
    throw new Error("EMPTY_ORDER_IDS");
  }
  const def = getExpeditorLoadingLayoutDef(layoutId);
  const wb = await loadExpeditorLoadingTemplateWorkbook(layoutId);
  const ctx = buildWarehouseAggregateContext(orders, options);
  if (layoutId === "ex-5.2.0") {
    fillExpeditorLoading520(wb, ctx, options, def.versionLabel);
  } else {
    fillExpeditorLoading518(wb, ctx, options, def.versionLabel);
    const sheet = wb.worksheets[0];
    if (sheet) trimTrailingEmptyRows(sheet, 1);
  }
  removeEmptyWorksheets(wb);
  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}

import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx.types";
import type { WarehouseLayoutId } from "./warehouse-template-ids";
import { loadWarehouseTemplateWorkbook } from "./warehouse-template-assets";
import { buildWarehouseAggregateContext } from "./warehouse-template-shared";
import { fillWarehouseTemplate } from "./warehouse-template-fill";
import { removeEmptyWorksheets } from "./warehouse-template-sanitize";
import { repairWorkbookBeforeWrite } from "./warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-template-zip-patch";

export async function buildWarehouseLoadXlsx(
  layoutId: WarehouseLayoutId,
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  if (orders.length === 0) {
    throw new Error("EMPTY_ORDER_IDS");
  }
  const wb = await loadWarehouseTemplateWorkbook(layoutId);
  const ctx = buildWarehouseAggregateContext(orders, options);
  fillWarehouseTemplate(layoutId, wb, ctx, options);
  removeEmptyWorksheets(wb);
  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}

import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx.types";
import type { ExpeditorLoadingLayoutId } from "./expeditor-loading-template-ids";
import { getExpeditorLoadingLayoutDef } from "./expeditor-loading-template-ids";
import { loadExpeditorLoadingTemplateWorkbook } from "./expeditor-loading-template-assets";
import { buildWarehouseAggregateContext } from "./warehouse-template-shared";
import { buildExpeditorLoading520Xlsx } from "./build-expeditor-loading-520";
import { fillExpeditorLoading518 } from "./fill/fill-expeditor-loading-518";
import { fillExpeditorLoadingMatrixAgents } from "./fill/fill-expeditor-loading-matrix-agents";
import { fillExpeditorLoadingMatrixClients } from "./fill/fill-expeditor-loading-matrix-clients";
import { fillExpeditorLoadingMatrix300 } from "./fill/fill-expeditor-loading-matrix-300";
import { fillExpeditorLoadingMulti401 } from "./fill/fill-expeditor-loading-multi-401";
import { expeditorLoadingFillFamily } from "./expeditor-loading-layout-family";
import { detectFillFamilyFromSheet, pickExpeditorDataSheet } from "./expeditor-loading-fill-shared";
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
  if (layoutId === "ex-5.2.0") {
    return buildExpeditorLoading520Xlsx(orders, options);
  }

  const def = getExpeditorLoadingLayoutDef(layoutId);
  const wb = await loadExpeditorLoadingTemplateWorkbook(layoutId);
  const ctx = buildWarehouseAggregateContext(orders, options);
  const dataSheet = pickExpeditorDataSheet(wb, def.versionLabel);
  const family = detectFillFamilyFromSheet(dataSheet) ?? expeditorLoadingFillFamily(layoutId);
  const wbOne = { worksheets: [dataSheet, ...wb.worksheets.filter((w) => w !== dataSheet)] } as typeof wb;
  switch (family) {
    case "list518":
      fillExpeditorLoading518(wbOne, ctx, options, def.versionLabel);
      break;
    case "matrixAgents":
      fillExpeditorLoadingMatrixAgents(wbOne, ctx, options, def.versionLabel);
      break;
    case "matrixClients":
      fillExpeditorLoadingMatrixClients(wbOne, ctx, options, def.versionLabel);
      break;
    case "matrix300":
      fillExpeditorLoadingMatrix300(wbOne, ctx, options, def.versionLabel);
      break;
    case "multi401":
      fillExpeditorLoadingMulti401(wb, ctx, options, def.versionLabel);
      break;
  }
  const sheet = dataSheet;
  if (sheet) trimTrailingEmptyRows(sheet, 1);
  removeEmptyWorksheets(wb);
  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}

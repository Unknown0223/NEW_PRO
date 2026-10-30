import ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx.types";
import type { ExpeditorLoadingLayoutId } from "./expeditor-loading-template-ids";
import { getExpeditorLoadingLayoutDef } from "./expeditor-loading-template-ids";
import { loadExpeditorLoadingTemplateWorkbook } from "./expeditor-loading-template-assets";
import { buildWarehouseAggregateContext } from "./warehouse-template-shared";
import { buildExpeditorLoading520Xlsx } from "./build-expeditor-loading-520";
import { buildExpeditorLoading518Xlsx } from "./expeditor-loading-518-xlsx";
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
import {
  layoutSheetCode,
  numberedSheetName,
  singleSheetOptions,
  splitOrdersIntoSheetGroups,
  uniqueSheetName
} from "./nakladnoy-sheet-groups";
import { copyWorksheetInto } from "./warehouse-template-sheet-copy";

async function fillExpeditorTemplateWorkbook(
  layoutId: ExpeditorLoadingLayoutId,
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<{ wb: ExcelJS.Workbook; dataSheet: ExcelJS.Worksheet }> {
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
  trimTrailingEmptyRows(dataSheet, 1);
  removeEmptyWorksheets(wb);
  return { wb, dataSheet };
}

async function writeWorkbook(wb: ExcelJS.Workbook): Promise<Buffer> {
  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}

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
  if (layoutId === "ex-5.1.8") {
    return buildExpeditorLoading518Xlsx(orders, options);
  }

  if (!options.separateSheets) {
    const { wb } = await fillExpeditorTemplateWorkbook(layoutId, orders, options);
    return writeWorkbook(wb);
  }

  const def = getExpeditorLoadingLayoutDef(layoutId);
  const code = def.filePrefix ?? layoutSheetCode(def.versionLabel);
  const out = new ExcelJS.Workbook();
  out.creator = "SALESDOC";
  const used = new Set<string>();
  const groups = splitOrdersIntoSheetGroups(orders, options);
  for (const [i, group] of groups.entries()) {
    const { wb, dataSheet } = await fillExpeditorTemplateWorkbook(
      layoutId,
      group.orders,
      singleSheetOptions(options)
    );
    const sheets = [dataSheet, ...wb.worksheets.filter((w) => w !== dataSheet && w.state !== "hidden")];
    sheets.forEach((sheet, k) => {
      const label = k === 0 ? group.label : `${group.label} ${k + 1}`;
      copyWorksheetInto(out, sheet, uniqueSheetName(used, numberedSheetName(i + 1, code, label)));
    });
  }
  return writeWorkbook(out);
}

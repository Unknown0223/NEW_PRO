import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx.types";
import { getExpeditorLoadingLayoutDef } from "./expeditor-loading-template-ids";
import { buildWarehouseAggregateContext } from "./warehouse-template-shared";
import {
  buildExpeditorLoading520Document,
  type ExpeditorLoading520Document
} from "./expeditor-loading-520-document";
import { buildExpeditorLoading520XlsxFromDocuments } from "./expeditor-loading-520-xlsx";
import { numberedSheetName, singleSheetOptions, splitOrdersIntoSheetGroups } from "./nakladnoy-sheet-groups";

/** 5.2.0 — har guruh (экспедитор / агент / территория) uchun alohida hujjat. */
export function buildExpeditorLoading520Documents(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): ExpeditorLoading520Document[] {
  const def = getExpeditorLoadingLayoutDef("ex-5.2.0");
  const now = new Date();
  return splitOrdersIntoSheetGroups(orders, options).map((group, i) => {
    const ctx = buildWarehouseAggregateContext(group.orders, singleSheetOptions(options));
    ctx.now = now;
    const doc = buildExpeditorLoading520Document(ctx, options, def.versionLabel);
    if (options.separateSheets) doc.sheetName = numberedSheetName(i + 1, "520", group.label);
    return doc;
  });
}

/** 5.2.0 — virtual preview bilan bir xil hujjatdan Excel (shablon asset ishlatilmaydi) */
export async function buildExpeditorLoading520Xlsx(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  if (orders.length === 0) {
    throw new Error("EMPTY_ORDER_IDS");
  }
  return buildExpeditorLoading520XlsxFromDocuments(buildExpeditorLoading520Documents(orders, options));
}

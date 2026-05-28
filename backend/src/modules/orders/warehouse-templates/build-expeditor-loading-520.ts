import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx.types";
import { getExpeditorLoadingLayoutDef } from "./expeditor-loading-template-ids";
import { buildWarehouseAggregateContext } from "./warehouse-template-shared";
import { buildExpeditorLoading520Document } from "./expeditor-loading-520-document";
import { buildExpeditorLoading520XlsxFromDocument } from "./expeditor-loading-520-xlsx";

/** 5.2.0 — virtual preview bilan bir xil hujjatdan Excel (shablon asset ishlatilmaydi) */
export async function buildExpeditorLoading520Xlsx(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  if (orders.length === 0) {
    throw new Error("EMPTY_ORDER_IDS");
  }
  const def = getExpeditorLoadingLayoutDef("ex-5.2.0");
  const ctx = buildWarehouseAggregateContext(orders, options);
  const doc = buildExpeditorLoading520Document(ctx, options, def.versionLabel);
  return buildExpeditorLoading520XlsxFromDocument(doc);
}

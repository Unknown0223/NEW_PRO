import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { preprocessExpeditorTemplateBuffer } from "../src/modules/orders/warehouse-templates/expeditor-template-preprocess";
import { fillExpeditorLoadingMatrixAgentsSheet } from "../src/modules/orders/warehouse-templates/fill/fill-expeditor-loading-matrix-agents";
import { pickExpeditorDataSheet } from "../src/modules/orders/warehouse-templates/expeditor-loading-fill-shared";
import { loadExpeditorLoadingTemplateWorkbook } from "../src/modules/orders/warehouse-templates/expeditor-loading-template-assets";
import { buildWarehouseAggregateContext } from "../src/modules/orders/warehouse-templates/warehouse-template-shared";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import type { NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";

const mock: NakladnoyOrderPayload = {
  id: 1,
  number: "T",
  createdAt: new Date("2026-05-27"),
  tenantName: "T",
  tenantPhone: null,
  clientName: "C",
  clientAddress: "",
  currencyLabel: "сум",
  agentLine: "Бисёр Маркэт",
  expeditorLine: "ZULFIQOROV ULUG'BEK",
  territory: "BALIQCHI",
  warehouseName: "W",
  agentId: 1,
  expeditorUserId: 1,
  lines: [
    {
      productId: 1,
      sku: "SKU-001",
      barcode: "1",
      name: "POMPI MINI №-1",
      qty: 7,
      price: 25500,
      sum: 178500,
      bonusQty: 0,
      groupTitle: "LIPUCHKA",
      qtyPerBlock: null
    }
  ],
  paidLines: [],
  bonusLines: []
};

async function main() {
  const wb = await loadExpeditorLoadingTemplateWorkbook("ex-5.1.6");
  console.log(
    "sheets",
    wb.worksheets.map((w) => `${w.name}:${w.rowCount}`)
  );
  const sheet = pickExpeditorDataSheet(wb, "5.1.6");
  console.log("data sheet", sheet.name);
  const ctx = buildWarehouseAggregateContext([mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  fillExpeditorLoadingMatrixAgentsSheet(sheet, ctx, "5.1.6");
  console.log("r10 c6", sheet.getCell(10, 6).value, "c7", sheet.getCell(10, 7).value);
}

main();

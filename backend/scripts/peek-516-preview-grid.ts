import { readFileSync } from "fs";
import { join } from "path";
import { buildExpeditorLoadingXlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx";
import { workbookBufferToNakladnoyPreview } from "../src/modules/orders/warehouse-templates/nakladnoy-xlsx-preview";
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
      sku: "G-PM001",
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
  const buf = await buildExpeditorLoadingXlsx("ex-5.1.6", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const preview = await workbookBufferToNakladnoyPreview(buf, { label: "5.1.6", filename: "t.xlsx" });
  const rows = preview.pages[0]!.grid!.rows;
  console.log("colCount", preview.pages[0]!.grid!.colCount);
  for (let ri = 0; ri < 8; ri++) {
    const row = rows[ri]!;
    const cells: string[] = [];
    for (let ci = 0; ci < row.length; ci++) {
      const c = row[ci]!;
      if (c.skip) cells.push("_");
      else if (c.colSpan && c.colSpan > 1) cells.push(`[${c.v.slice(0, 12)}]x${c.colSpan}`);
      else if (c.v) cells.push(c.v.slice(0, 10));
      else cells.push("·");
    }
    console.log(`r${ri + 1}`, cells.join("|"));
  }
}

main().catch(console.error);

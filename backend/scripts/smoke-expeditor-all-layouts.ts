import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { buildExpeditorLoadingXlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx";
import { EXPEDITOR_LOADING_LAYOUT_IDS } from "../src/modules/orders/warehouse-templates/expeditor-loading-template-ids";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import type { NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";

const mock: NakladnoyOrderPayload = {
  id: 1,
  number: "T-1",
  createdAt: new Date("2026-05-27"),
  tenantName: "T",
  tenantPhone: null,
  clientName: "Бисёр Маркэт",
  clientAddress: "PAHTAOBOD",
  currencyLabel: "сум",
  agentLine: "Бисёр Маркэт [+998995406080]",
  expeditorLine: "G'ulomov Xayotbek",
  territory: "BALIQCHI",
  warehouseName: "W",
  agentId: 1,
  expeditorUserId: 1,
  lines: [
    {
      productId: 1,
      sku: "G-PM006",
      barcode: "123",
      name: "POMPI MINI №-6",
      qty: 5,
      price: 25500,
      sum: 127500,
      bonusQty: 0,
      groupTitle: "LIPUCHKA",
      qtyPerBlock: null
    },
    {
      productId: 2,
      sku: "G-PM004",
      barcode: "124",
      name: "POMPI MINI №-4",
      qty: 3,
      price: 25500,
      sum: 76500,
      bonusQty: 0,
      groupTitle: "LIPUCHKA",
      qtyPerBlock: null
    }
  ],
  paidLines: [],
  bonusLines: []
};

const outDir = join(__dirname, "audit-output", "expeditor-smoke");
mkdirSync(outDir, { recursive: true });

async function main() {
  const results: Record<string, string> = {};
  for (const id of EXPEDITOR_LOADING_LAYOUT_IDS) {
    try {
      const buf = await buildExpeditorLoadingXlsx(id, [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
      const p = join(outDir, `${id}.xlsx`);
      writeFileSync(p, buf);
      results[id] = `OK ${buf.length}`;
    } catch (e) {
      results[id] = `FAIL ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

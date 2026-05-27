import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";
import { buildExpeditorLoadingXlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import type { NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";

const outDir = join(__dirname, "audit-output", "xml-compare-expeditor");
mkdirSync(outDir, { recursive: true });

const mockPayload: NakladnoyOrderPayload = {
  id: 1,
  number: "TEST-1",
  createdAt: new Date("2026-05-26"),
  tenantName: "Test",
  tenantPhone: null,
  clientName: "Клиент",
  clientBalanceNum: null,
  clientAddress: "Адрес",
  currencyLabel: "сум",
  agentLine: "A1",
  expeditorLine: "E1",
  territory: "Ташкент",
  warehouseName: "Склад",
  agentId: 1,
  expeditorUserId: 1,
  lines: [
    {
      productId: 1,
      sku: "SKU1",
      barcode: "123",
      name: "Товар 1",
      qty: 2,
      price: 1000,
      sum: 2000,
      bonusQty: 0,
      groupTitle: "Группа",
      qtyPerBlock: null
    },
    {
      productId: 2,
      sku: "SKU2",
      barcode: null,
      name: "Товар 2",
      qty: 0,
      price: 0,
      sum: 0,
      bonusQty: 3,
      groupTitle: "Группа2",
      qtyPerBlock: null
    }
  ],
  paidLines: [],
  bonusLines: []
};

async function main() {
  const buf = await buildExpeditorLoadingXlsx("ex-5.1.8", [mockPayload], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const genPath = join(outDir, "generated-ex-5.1.8.xlsx");
  writeFileSync(genPath, buf);

  const zip = await JSZip.loadAsync(readFileSync(genPath));
  const sheet = "xl/worksheets/sheet1.xml";
  const xml = await zip.file(sheet)!.async("string");
  const hasReturnLabel = xml.includes("Возврат с полки");
  const hasWeightLabel = xml.toLowerCase().includes("общее") && xml.toLowerCase().includes("вес");

  console.log(JSON.stringify({ genPath, sheet, hasReturnLabel, hasWeightLabel }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


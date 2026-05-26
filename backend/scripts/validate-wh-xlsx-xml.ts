/**
 * Generates wh-1.1 sample and compares sheet XML structure to template asset.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import JSZip from "jszip";
import { buildWarehouseLoadXlsx } from "../src/modules/orders/warehouse-templates/build-warehouse-load-xlsx";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import type { NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";

const outDir = join(__dirname, "audit-output", "xml-compare");
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
  agentLine: "Агент (A1)",
  expeditorLine: "Экспедитор (E1)",
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
    }
  ],
  paidLines: [],
  bonusLines: []
};

async function main() {
  const buf = await buildWarehouseLoadXlsx("wh-1.1", [mockPayload], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const genPath = join(outDir, "generated-wh-1.1.xlsx");
  writeFileSync(genPath, buf);

  const assetPath = join(__dirname, "../assets/nakladnoy/warehouse/110-wh-1.1.xlsx");

  async function inspect(label: string, p: string) {
    const zip = await JSZip.loadAsync(readFileSync(p));
    for (const sheet of ["sheet1.xml", "sheet2.xml", "sheet3.xml"]) {
      const f = zip.file(`xl/worksheets/${sheet}`);
      if (!f) {
        console.log(`${label}: no ${sheet}`);
        continue;
      }
      const xml = await f.async("string");
      const line2 = xml.split("\n")[1] ?? "";
      const singleMerge = (xml.match(/mergeCell ref="([A-Z]+)(\d+):\1\2"/gi) ?? []).length;
      const hasSheetData = xml.includes("<sheetData>");
      const rowCount = (xml.match(/<row /g) ?? []).length;
      console.log(
        `${label} ${sheet}: rows=${rowCount} sheetData=${hasSheetData} singleMerges=${singleMerge} line2=${line2.slice(0, 60)}`
      );
    }
  }

  await inspect("asset", assetPath);
  await inspect("generated", genPath);
  console.log("OK — written", genPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

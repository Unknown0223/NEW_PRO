import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";
import { buildExpeditorLoading520Xlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-520";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import type { NakladnoyOrderPayload } from "../src/modules/orders/order-nakladnoy-xlsx.types";

const outDir = join(__dirname, "audit-output", "xml-compare-expeditor-520");
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
  currencyLabel: "So'm (UZS)",
  agentLine: "A1- [Agent] 998901234567",
  expeditorLine: "E1",
  territory: "TOSHKENT",
  warehouseName: "Склад",
  agentId: 1,
  expeditorUserId: 1,
  lines: [
    {
      productId: 1,
      sku: "SKU-001",
      barcode: "123456",
      name: "Mahsulot 1",
      qty: 10,
      price: 132000,
      sum: 1320000,
      bonusQty: 2,
      groupTitle: "Ichimliklar",
      qtyPerBlock: null
    },
    {
      productId: 2,
      sku: "SKU-002",
      barcode: "789",
      name: "Mahsulot 2",
      qty: 5,
      price: 72000,
      sum: 360000,
      bonusQty: 0,
      groupTitle: "Ichimliklar",
      qtyPerBlock: null
    }
  ],
  paidLines: [],
  bonusLines: []
};

async function main() {
  const buf = await buildExpeditorLoading520Xlsx([mockPayload], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const genPath = join(outDir, "generated-ex-5.2.0.xlsx");
  writeFileSync(genPath, buf);

  const zip = await JSZip.loadAsync(readFileSync(genPath));
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const ssXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";

  const hasTitleMerge = sheetXml.includes('mergeCell ref="A1:H1"');
  const hasBonusesBlock = sheetXml.includes("Бонусы") || ssXml.includes("Бонусы");
  const hasReturnBlock = sheetXml.includes("Возврат") || ssXml.includes("Возврат");
  const hasItogo = sheetXml.includes("Итого") || ssXml.includes("Итого");

  const wb = await import("exceljs").then((m) => new m.default.Workbook());
  await wb.xlsx.readFile(genPath);
  const ws = wb.worksheets[0]!;
  let itogoQty = 0;
  let itogoSum = "";
  ws.eachRow((row, rowNumber) => {
    const label = String(row.getCell(1).value ?? "");
    if (label === "Итого") {
      itogoQty = Number(row.getCell(5).value ?? 0);
      itogoSum = String(row.getCell(7).value ?? "");
    }
  });

  const ok =
    hasTitleMerge &&
    !hasBonusesBlock &&
    !hasReturnBlock &&
    hasItogo &&
    itogoQty === 15 &&
    itogoSum.includes("680");

  console.log(
    JSON.stringify(
      {
        genPath,
        hasTitleMerge,
        hasBonusesBlock,
        hasReturnBlock,
        hasItogo,
        itogoQty,
        itogoSum,
        ok
      },
      null,
      2
    )
  );

  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

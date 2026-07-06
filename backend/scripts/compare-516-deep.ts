/**
 * v3 vs fresh 5.1.6 vs fresh 5.2.0 — chuqur XML solishtirish.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";
import { buildExpeditorLoadingXlsx } from "../src/modules/orders/warehouse-templates/build-expeditor-loading-xlsx";
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

const ALL_PATHS = [
  "xl/workbook.xml",
  "xl/worksheets/sheet1.xml",
  "xl/worksheets/_rels/sheet1.xml.rels",
  "xl/_rels/workbook.xml.rels",
  "xl/styles.xml",
  "xl/sharedStrings.xml",
  "[Content_Types].xml"
];

async function dumpAll(zip: JSZip, outDir: string, label: string) {
  for (const p of ALL_PATHS) {
    const xml = await zip.file(p)?.async("string");
    if (!xml) continue;
    const fn = p.replace(/[\\/\[\]]/g, "_");
    writeFileSync(join(outDir, `${label}__${fn}`), xml);
  }
}

async function diffSheet(zipA: JSZip, zipB: JSZip, lblA: string, lblB: string) {
  const a = (await zipA.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
  const b = (await zipB.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
  console.log(`\n${lblA} length=${a.length} vs ${lblB} length=${b.length}`);

  const aStart = a.slice(0, 600);
  const bStart = b.slice(0, 600);
  if (aStart !== bStart) {
    console.log(`\n--- ${lblA} START ---\n${aStart}\n--- ${lblB} START ---\n${bStart}`);
  } else {
    console.log("START identical");
  }

  const aEnd = a.slice(-500);
  const bEnd = b.slice(-500);
  if (aEnd !== bEnd) {
    console.log(`\n--- ${lblA} END ---\n${aEnd}\n--- ${lblB} END ---\n${bEnd}`);
  } else {
    console.log("END identical");
  }

  for (const tag of ["<dimension", "<sheetViews", "<cols", "<sheetData", "<mergeCells", "<pageMargins", "<pageSetup", "<headerFooter"]) {
    const ia = a.indexOf(tag);
    const ib = b.indexOf(tag);
    console.log(`tag ${tag.padEnd(15)} ${lblA}@${ia} ${lblB}@${ib}`);
  }
}

async function main() {
  const outDir = join(__dirname, "audit-output", "compare-516");
  const fs = await import("fs/promises");
  await fs.mkdir(outDir, { recursive: true });

  const v3 = readFileSync(join(__dirname, "audit-output", "516_FINAL_v3.xlsx"));
  const built516 = await buildExpeditorLoadingXlsx("ex-5.1.6", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const built520 = await buildExpeditorLoadingXlsx("ex-5.2.0", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);

  const z3 = await JSZip.loadAsync(v3);
  const z5 = await JSZip.loadAsync(built516);
  const z2 = await JSZip.loadAsync(built520);

  await dumpAll(z3, outDir, "v3");
  await dumpAll(z5, outDir, "fresh516");
  await dumpAll(z2, outDir, "fresh520");

  await diffSheet(z3, z5, "v3", "fresh516");
  await diffSheet(z2, z5, "fresh520", "fresh516");

  console.log("\nWritten to", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

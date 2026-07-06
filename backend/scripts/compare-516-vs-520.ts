/**
 * 516_FINAL_v3.xlsx (user-reported broken) vs freshly-built 5.2.0.xlsx.
 * Maqsad: 5.2.0 ochiladi, 516 ochilmaydi — XML/ZIP farqlarini ko'rsatish.
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

async function fingerprint(buf: Buffer, label: string) {
  const zip = await JSZip.loadAsync(buf);
  const files = Object.keys(zip.files)
    .filter((p) => !zip.files[p]!.dir)
    .sort();
  console.log(`\n=== ${label} (${buf.length} b, ${files.length} files) ===`);
  for (const p of files) {
    const sz = (await zip.file(p)!.async("uint8array")).length;
    console.log(`  ${p} (${sz} b)`);
  }
  return zip;
}

async function dumpKey(zip: JSZip, path: string, label: string) {
  const xml = await zip.file(path)?.async("string");
  if (!xml) {
    console.log(`[${label}] ${path} — MISSING`);
    return;
  }
  console.log(`\n[${label}] ${path} (${xml.length} chars):`);
  console.log(xml.slice(0, 800));
  if (xml.length > 800) console.log("…");
}

async function checkSheet(zip: JSZip, label: string) {
  const xml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  if (!xml) return;
  const checks = {
    badDpi: xml.includes("4294967295"),
    customHeight: /<sheetFormatPr[^>]*customHeight=/.test(xml),
    dyDescent: xml.includes("x14ac:dyDescent"),
    x14acNs: xml.includes("xmlns:x14ac"),
    mcIgnorable: xml.includes("mc:Ignorable"),
    singleCellMerge: /<mergeCell ref="([A-Z]+)(\d+):\1\2"/.test(xml),
    mergeCount: (xml.match(/<mergeCell /g) ?? []).length,
    rowCount: (xml.match(/<row /g) ?? []).length,
    hasRowHt: /<row [^>]*ht=/.test(xml),
    hasSheetFormatPr: /<sheetFormatPr/.test(xml),
    sheetFormatPr: /<sheetFormatPr[^/>]*\/?>/.exec(xml)?.[0] ?? null
  };
  console.log(`\n[${label}] sheet1 checks:`, JSON.stringify(checks, null, 2));
}

async function checkSst(zip: JSZip, label: string) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!xml) {
    console.log(`[${label}] no sharedStrings.xml`);
    return;
  }
  const si = (xml.match(/<si>/g) ?? []).length;
  const count = /count="(\d+)"/.exec(xml)?.[1];
  const unique = /uniqueCount="(\d+)"/.exec(xml)?.[1];
  console.log(`[${label}] sst: si=${si} count=${count} unique=${unique} chars=${xml.length}`);
}

async function main() {
  const v3 = readFileSync(join(__dirname, "audit-output", "516_FINAL_v3.xlsx"));
  const built516 = await buildExpeditorLoadingXlsx("ex-5.1.6", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);
  const built520 = await buildExpeditorLoadingXlsx("ex-5.2.0", [mock], DEFAULT_NAKLADNOY_BUILD_OPTIONS);

  writeFileSync(join(__dirname, "audit-output", "fresh-516.xlsx"), built516);
  writeFileSync(join(__dirname, "audit-output", "fresh-520.xlsx"), built520);

  const z3 = await fingerprint(v3, "USER v3");
  const z5 = await fingerprint(built516, "FRESH 5.1.6");
  const z2 = await fingerprint(built520, "FRESH 5.2.0");

  await checkSheet(z3, "v3");
  await checkSheet(z5, "fresh 516");
  await checkSheet(z2, "fresh 520");

  await checkSst(z3, "v3");
  await checkSst(z5, "fresh 516");
  await checkSst(z2, "fresh 520");

  await dumpKey(z2, "[Content_Types].xml", "520 ContentTypes");
  await dumpKey(z5, "[Content_Types].xml", "516 ContentTypes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

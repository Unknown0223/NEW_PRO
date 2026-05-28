import { readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

const p = join(__dirname, "audit-output/xml-compare-expeditor-520/generated-ex-5.2.0.xlsx");

async function main() {
  const zip = await JSZip.loadAsync(readFileSync(p));
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const badDpi = /4294967295/.test(sheet);
  const singleMerge = /<mergeCell ref="([A-Z]+)(\d+):\1\2"/i.test(sheet);
  console.log(JSON.stringify({ file: p, badDpi, singleMerge, ok: !badDpi && !singleMerge }));
  if (badDpi || singleMerge) process.exit(1);
}

main();

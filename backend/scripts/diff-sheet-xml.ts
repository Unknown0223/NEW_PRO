import { readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

async function getXml(p: string, sheet: string) {
  const z = await JSZip.loadAsync(readFileSync(p));
  const f = z.file(`xl/worksheets/${sheet}`);
  if (!f) throw new Error(`missing ${sheet} in ${p}`);
  return f.async("string");
}

async function main() {
  const asset = join(__dirname, "../assets/nakladnoy/warehouse/110-wh-1.1.xlsx");
  const rt = join(__dirname, "audit-output/roundtrip/roundtrip-no-ghost.xlsx");

  for (const sheet of ["sheet1.xml", "sheet2.xml"]) {
    const a = await getXml(asset, sheet);
    const b = await getXml(rt, sheet);
    console.log(`\n=== ${sheet} ===`);
    console.log("asset len", a.length, "rt len", b.length);

    let i = 0;
    for (; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) break;
    }
    console.log("first diff at", i);
    console.log("asset:", JSON.stringify(a.slice(Math.max(0, i - 30), i + 120)));
    console.log("rt:   ", JSON.stringify(b.slice(Math.max(0, i - 30), i + 120)));

    const mergeA = (a.match(/mergeCell/g) ?? []).length;
    const mergeB = (b.match(/mergeCell/g) ?? []).length;
    console.log("mergeCell count asset/rt", mergeA, mergeB);

    const singleA = (a.match(/mergeCell ref="([A-Z]+)(\d+):\1\2"/gi) ?? []).length;
    const singleB = (b.match(/mergeCell ref="([A-Z]+)(\d+):\1\2"/gi) ?? []).length;
    console.log("single-cell merges asset/rt", singleA, singleB);

    // validate well-formedness roughly
    const openTags = (b.match(/<[^/!?][^>]*>/g) ?? []).length;
    const closeTags = (b.match(/<\/[^>]+>/g) ?? []).length;
    console.log("rt open/close-ish", openTags, closeTags);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

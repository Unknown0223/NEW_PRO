import { readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

async function rootLine(path: string, sheet: string) {
  const z = await JSZip.loadAsync(readFileSync(path));
  const xml = await z.file(`xl/worksheets/${sheet}`)!.async("string");
  const lines = xml.split(/\r?\n/);
  console.log(`\n${path} ${sheet}:`);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    console.log(`L${i + 1}:`, lines[i]);
  }
}

async function main() {
  const asset = join(__dirname, "../assets/nakladnoy/warehouse/110-wh-1.1.xlsx");
  const rt = join(__dirname, "audit-output/roundtrip/roundtrip-no-ghost.xlsx");
  const gen = join(__dirname, "audit-output/xml-compare/generated-wh-1.1.xlsx");
  await rootLine(asset, "sheet1.xml");
  await rootLine(rt, "sheet1.xml");
  try {
    await rootLine(gen, "sheet1.xml");
  } catch {
    console.log("no generated");
  }
}

main();

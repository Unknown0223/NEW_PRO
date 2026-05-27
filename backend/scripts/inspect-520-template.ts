import { readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

const p = join(__dirname, "../assets/nakladnoy/loading/520-zagruz-5.2.0.xlsx");

async function main() {
  const zip = await JSZip.loadAsync(readFileSync(p));
  const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const merges = [...xml.matchAll(/mergeCell ref="([^"]+)"/g)].map((m) => m[1]!);
  console.log("template merges", merges.length);
  console.log(merges.join(", "));
  for (const r of [8, 9, 16, 17, 18, 19, 20]) {
    const m = xml.match(new RegExp(`<row r="${r}"[^>]*>([\\s\\S]*?)</row>`));
    if (m) console.log(`row${r}:`, m[1]!.slice(0, 250));
  }
}

main();

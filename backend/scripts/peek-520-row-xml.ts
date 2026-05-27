import { readFileSync } from "fs";
import JSZip from "jszip";

const paths = [
  process.argv[2]!,
  process.argv[3]
].filter(Boolean);

async function peek(path: string) {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  console.log("\n#", path);
  for (const r of [2, 12, 13, 14, 15, 16]) {
    const m = xml.match(new RegExp(`<row r="${r}"[^>]*>([\\s\\S]*?)</row>`));
    if (m) console.log(`row${r}:`, m[1]!.slice(0, 400));
  }
  const dpi = xml.match(/4294967295/g);
  console.log("bad dpi count:", dpi?.length ?? 0);
}

for (const p of paths) peek(p);

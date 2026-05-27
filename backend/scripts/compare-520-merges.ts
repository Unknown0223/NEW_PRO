import { readFileSync, existsSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

const SINGLE_CELL = /<mergeCell ref="([A-Z]+)(\d+):\1\2"\s*\/?>/gi;

function colToNum(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseRef(ref: string) {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref);
  if (!m) return null;
  return {
    c1: m[1]!.toUpperCase(),
    r1: +m[2]!,
    c2: m[3]!.toUpperCase(),
    r2: +m[4]!,
    cn1: colToNum(m[1]!),
    cn2: colToNum(m[3]!)
  };
}

async function analyze(label: string, path: string) {
  if (!existsSync(path)) {
    console.log(`[MISSING] ${label}: ${path}`);
    return;
  }
  const zip = await JSZip.loadAsync(readFileSync(path));
  const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const dim = xml.match(/dimension ref="([^"]+)"/)?.[1] ?? "?";
  const merges = [...xml.matchAll(/mergeCell ref="([^"]+)"/g)].map((m) => m[1]!);
  const rows = new Set<number>();
  for (const m of xml.matchAll(/<row r="(\d+)"/g)) rows.add(+m[1]!);
  const maxRow = Math.max(...rows, 0);

  const single = [...xml.matchAll(SINGLE_CELL)].map((m) => m[0]);
  const orphan: string[] = [];
  const overlap: string[] = [];
  const parsed = merges.map((ref) => ({ ref, ...parseRef(ref)! })).filter((x) => x.ref);

  for (const m of parsed) {
    if (m.r1 > maxRow || m.r2 > maxRow) orphan.push(`${m.ref} (maxRow=${maxRow})`);
    if (m.c1 === m.c2 && m.r1 === m.r2) overlap.push(m.ref);
  }

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i]!;
      const b = parsed[j]!;
      const rowOverlap = !(a.r2 < b.r1 || b.r2 < a.r1);
      const colOverlap = !(a.cn2 < b.cn1 || b.cn2 < a.cn1);
      if (rowOverlap && colOverlap) overlap.push(`${a.ref} ∩ ${b.ref}`);
    }
  }

  console.log(`\n=== ${label} ===`);
  console.log("path", path);
  console.log("dimension", dim, "maxRow", maxRow, "merges", merges.length);
  console.log("merges:", merges.join(", "));
  if (single.length) console.log("single-cell:", single);
  if (orphan.length) console.log("orphan (row>max):", orphan);
  if (overlap.length) console.log("overlap/single:", [...new Set(overlap)]);
}

async function main() {
  const gen = join(__dirname, "audit-output/xml-compare-expeditor-520/generated-ex-5.2.0.xlsx");
  const userDl = "C:\\Users\\botir\\Downloads\\nakladnoy_2026-05-26 (12).xlsx";
  const userAudit = join(__dirname, "audit-output/user-nak.xlsx");

  await analyze("generated", gen);
  await analyze("user-downloads", userDl);
  if (existsSync(userAudit)) await analyze("user-audit", userAudit);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

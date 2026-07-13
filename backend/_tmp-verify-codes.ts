import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "./src/config/database";

function parseCodesFromXlsx(xlsxPath: string): string[] {
  // lightweight: use existing script approach via dynamic import of xlsx if available
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const codes: string[] = [];
  for (const row of rows) {
    for (const v of Object.values(row)) {
      const s = String(v ?? "").trim();
      if (/^[a-z0-9]{2}_\d+$/i.test(s)) codes.push(s.toLowerCase());
    }
  }
  return [...new Set(codes)];
}

async function main() {
  const xlsxPath =
    process.argv[2] ||
    path.join(process.env.USERPROFILE || "", "Downloads", "Балансы клиентов(По  агентам).xlsx");
  if (!fs.existsSync(xlsxPath)) {
    console.error("File not found:", xlsxPath);
    process.exit(1);
  }
  const tenant = await prisma.tenant.findFirst({ where: { slug: "test1" }, select: { id: true } });
  if (!tenant) return;
  const codes = parseCodesFromXlsx(xlsxPath);
  let match = 0;
  let miss = 0;
  const missSamples: string[] = [];
  for (const code of codes.slice(0, 500)) {
    const num = Number.parseInt(code.split("_")[1]!, 10);
    const c = await prisma.client.findFirst({
      where: { tenant_id: tenant.id, id: num, merged_into_client_id: null },
      select: { id: true }
    });
    if (c) match++;
    else {
      miss++;
      if (missSamples.length < 10) missSamples.push(code);
    }
  }
  console.log({ total: codes.length, checked: Math.min(500, codes.length), match, miss, missSamples });
}

main().finally(() => prisma.$disconnect());

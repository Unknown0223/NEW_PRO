/**
 * SalesDoc tashqi mijoz kodlarini `clients.client_code` ga yozadi.
 *
 * Excel: «Ид клиента» ustuni — `ur_29411`, `wr_1173`, …
 * Raqam qismi ichki `clients.id` bilan mos keladi.
 *
 *   cd backend
 *   $env:IMPORT_TENANT_SLUG='test1'
 *   $env:CLIENT_CODES_XLSX='C:\Users\...\Балансы клиентов(По  агентам).xlsx'
 *   npx tsx scripts/backfill-client-codes-xlsx.ts
 *
 * Sinov: CLIENT_CODES_DRY_RUN=1
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  isExternalClientCode,
  parseExternalClientCodeSuffix
} from "../shared/client-display-id";

const prisma = new PrismaClient();

function truthy(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "yes";
}

function collectCodesFromWorkbook(xlsxPath: string): Map<number, string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.readFile(xlsxPath);
  const out = new Map<number, string>();

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    for (const row of rows) {
      for (const v of Object.values(row)) {
        const raw = String(v ?? "").trim();
        if (!isExternalClientCode(raw)) continue;
        const id = parseExternalClientCodeSuffix(raw);
        if (id == null) continue;
        out.set(id, raw.toLowerCase());
      }
    }
  }
  return out;
}

async function main() {
  const dry = truthy(process.env.CLIENT_CODES_DRY_RUN);
  const slug = (process.env.IMPORT_TENANT_SLUG || "test1").trim();
  const xlsxPath =
    process.env.CLIENT_CODES_XLSX?.trim() ||
    path.join(process.env.USERPROFILE || "", "Downloads", "Балансы клиентов(По  агентам).xlsx");

  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`Excel topilmadi: ${xlsxPath}`);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const codeById = collectCodesFromWorkbook(xlsxPath);
  console.log(`Tenant: ${slug}  |  kodlar: ${codeById.size}  |  dry-run: ${dry}`);
  console.log(`Fayl: ${xlsxPath}`);

  let updated = 0;
  let skipped = 0;
  let missing = 0;
  const conflicts: string[] = [];

  for (const [clientId, code] of codeById) {
    const row = await prisma.client.findFirst({
      where: { tenant_id: tenant.id, id: clientId, merged_into_client_id: null },
      select: { id: true, client_code: true, name: true }
    });
    if (!row) {
      missing += 1;
      continue;
    }
    const existing = row.client_code?.trim().toLowerCase() ?? "";
    if (existing === code) {
      skipped += 1;
      continue;
    }
    if (existing && existing !== code) {
      conflicts.push(`id=${clientId}: ${existing} → ${code}`);
      continue;
    }
    if (!dry) {
      await prisma.client.update({
        where: { id: row.id },
        data: { client_code: code.slice(0, 32) }
      });
    }
    updated += 1;
  }

  console.log({ updated, skipped, missing, conflicts: conflicts.length });
  if (conflicts.length > 0) {
    console.log("Konfliktlar (o‘tkazib yuborildi):");
    for (const line of conflicts.slice(0, 20)) console.log(" ", line);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

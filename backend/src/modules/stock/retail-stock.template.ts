import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


export async function buildRetailStockTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("RetailStock", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = [
    "Дата",
    "Клиент",
    "Продукт",
    "Количество",
    "Кол-во (продажа)",
    "Цена",
    "Сумма",
    "Тип цены",
    "Объем",
    "Комментарий"
  ];
  const sample = ["2026-04-25", "DO'KON №1", "SKU-001", "12", "3", "15000", "180000", "retail", "12 packs", ""];
  headers.forEach((h, i) => {
    sheet.getRow(1).getCell(i + 1).value = h;
    sheet.getRow(1).getCell(i + 1).font = { bold: true };
    sheet.getRow(2).getCell(i + 1).value = sample[i] ?? "";
  });
  sheet.columns = [
    { width: 14 },
    { width: 32 },
    { width: 24 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 16 },
    { width: 28 }
  ];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

type RetailImportResult = { applied: number; errors: string[] };

function numFromCell(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number.parseFloat(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function strFromCell(cell: ExcelJS.Cell): string {
  const raw = cell.text ?? cell.value ?? "";
  return String(raw).trim();
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function headerIndexByAliases(headers: Map<string, number>, aliases: string[]): number | undefined {
  for (const a of aliases) {
    const idx = headers.get(normalizeHeader(a));
    if (idx != null) return idx;
  }
  return undefined;
}

async function resolveClientId(tenantId: number, raw: string): Promise<number | null> {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const byId = await prisma.client.findFirst({ where: { tenant_id: tenantId, id: Number.parseInt(raw, 10) } });
    if (byId) return byId.id;
  }
  const byName = await prisma.client.findFirst({
    where: { tenant_id: tenantId, name: { equals: raw, mode: "insensitive" } },
    select: { id: true }
  });
  return byName?.id ?? null;
}

async function resolveProductId(tenantId: number, raw: string): Promise<number | null> {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const byId = await prisma.product.findFirst({ where: { tenant_id: tenantId, id: Number.parseInt(raw, 10) } });
    if (byId) return byId.id;
  }
  const bySku = await prisma.product.findFirst({
    where: { tenant_id: tenantId, sku: { equals: raw, mode: "insensitive" } },
    select: { id: true }
  });
  if (bySku) return bySku.id;
  const byName = await prisma.product.findFirst({
    where: { tenant_id: tenantId, name: { equals: raw, mode: "insensitive" } },
    select: { id: true }
  });
  return byName?.id ?? null;
}


import ExcelJS from "exceljs";
import { prisma } from "../../config/database";

export type RetailImportResult = { applied: number; errors: string[] };

export function numFromCell(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number.parseFloat(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function strFromCell(cell: ExcelJS.Cell): string {
  const raw = cell.text ?? cell.value ?? "";
  return String(raw).trim();
}

export function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function headerIndexByAliases(headers: Map<string, number>, aliases: string[]): number | undefined {
  for (const a of aliases) {
    const idx = headers.get(normalizeHeader(a));
    if (idx != null) return idx;
  }
  return undefined;
}

export async function resolveClientId(tenantId: number, raw: string): Promise<number | null> {
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

export async function resolveProductId(tenantId: number, raw: string): Promise<number | null> {
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

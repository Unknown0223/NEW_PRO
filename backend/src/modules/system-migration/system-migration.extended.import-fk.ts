import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import type { ExtendedTableSpec } from "./system-migration.extended-specs";
import { readZipJson } from "./system-migration.parse";

type Tx = Prisma.TransactionClient;

/** Majburiy FK null bo‘lsa create qilinmasin (Prisma «Argument missing» o‘rniga ogohlantirish). */
export function missingRequiredFk(
  data: Record<string, unknown>,
  spec: ExtendedTableSpec
): string | null {
  if (!spec.fk) return null;
  const required = spec.requiredFk ?? (spec.noId ? Object.keys(spec.fk) : []);
  for (const field of required) {
    const v = data[field];
    if (v == null || v === "") return field;
  }
  return null;
}

/** Foydalanuvchiga sodda o‘zbekcha ogohlantirish (texnik yo‘l / Prisma yo‘q). */
export function fkSkipWarningUz(specFile: string, field: string): string {
  if (field === "product_id") {
    if (specFile === "product_prices") {
      return "Mahsulot narxi import qilinmadi: mahsulot topilmadi";
    }
    if (specFile === "product_price_schedules") {
      return "Rejalashtirilgan narx import qilinmadi: mahsulot topilmadi";
    }
    return "Qator import qilinmadi: mahsulot topilmadi";
  }
  if (field === "client_id") return "Qator import qilinmadi: mijoz topilmadi";
  if (field === "warehouse_id") return "Qator import qilinmadi: ombor topilmadi";
  if (field === "user_id" || field.endsWith("_user_id") || field === "agent_id") {
    return "Qator import qilinmadi: foydalanuvchi topilmadi";
  }
  return `${specFile}: ${field} bog‘lanishi topilmadi — qator o‘tkazib yuborildi.`;
}

/**
 * Spravochniklar import qilinmagan yoki qisman map bo‘lsa — ZIP dagi SKU bo‘yicha
 * mavjud mahsulotlarga ID map to‘ldirish (narxlar importi uchun).
 */
export async function ensureProductIdMap(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps
): Promise<void> {
  const products = await readZipJson<Record<string, unknown>>(zip, "data/products.json");
  if (!products.length) return;

  for (const row of products) {
    const oldId = Number(row.id);
    if (!Number.isFinite(oldId) || maps.product.has(oldId)) continue;
    const skuRaw = row.sku;
    const sku =
      typeof skuRaw === "string" ? skuRaw.trim() : skuRaw == null ? "" : String(skuRaw).trim();
    if (!sku) continue;
    const existing = await tx.product.findUnique({
      where: { tenant_id_sku: { tenant_id: tenantId, sku } }
    });
    if (existing) maps.product.set(oldId, existing.id);
  }
}

/** Prisma client validatsiyasidan FK maydonini taxmin qilish. */
export function guessMissingFkFieldFromPrismaMessage(msg: string): string {
  const arg = msg.match(/Argument [`']?(\w+)[`']? is missing/i)?.[1];
  if (arg === "product") return "product_id";
  if (arg === "client") return "client_id";
  if (arg === "warehouse") return "warehouse_id";
  if (arg) return `${arg}_id`;
  return "product_id";
}

export function isPrismaMissingArgError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /Argument [`']?\w+[`']? is missing|Invalid `.*\.create\(\)` invocation/i.test(msg);
}

import { prisma } from "../../config/database";

/** Taqqoslash uchun: trim + lower + ortiqcha bo‘shliqlarni bitta qilish */
export function normalizeProductDupKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function findProductBySkuCi(
  tenantId: number,
  sku: string,
  excludeId?: number | null
) {
  const t = sku.trim();
  if (!t) return null;
  return prisma.product.findFirst({
    where: {
      tenant_id: tenantId,
      sku: { equals: t, mode: "insensitive" },
      ...(excludeId != null ? { NOT: { id: excludeId } } : {})
    },
    select: { id: true, sku: true, name: true, barcode: true, is_active: true }
  });
}

export async function findProductByNameCi(
  tenantId: number,
  name: string,
  excludeId?: number | null
) {
  const t = name.trim();
  if (!t) return null;
  return prisma.product.findFirst({
    where: {
      tenant_id: tenantId,
      name: { equals: t, mode: "insensitive" },
      ...(excludeId != null ? { NOT: { id: excludeId } } : {})
    },
    select: { id: true, sku: true, name: true, barcode: true, is_active: true }
  });
}

export async function findProductByBarcodeCi(
  tenantId: number,
  barcode: string,
  excludeId?: number | null
) {
  const t = barcode.trim();
  if (!t) return null;
  return prisma.product.findFirst({
    where: {
      tenant_id: tenantId,
      barcode: { equals: t, mode: "insensitive" },
      ...(excludeId != null ? { NOT: { id: excludeId } } : {})
    },
    select: { id: true, sku: true, name: true, barcode: true, is_active: true }
  });
}

/** Create/update oldidan dublikat tekshiruvi. Xato kodlari: SKU_EXISTS | NAME_EXISTS | BARCODE_EXISTS */
export async function assertProductUniqueness(
  tenantId: number,
  input: { sku?: string | null; name?: string | null; barcode?: string | null },
  excludeId?: number | null
): Promise<void> {
  if (input.sku != null && input.sku.trim()) {
    const clash = await findProductBySkuCi(tenantId, input.sku, excludeId);
    if (clash) throw new Error("SKU_EXISTS");
  }
  if (input.name != null && input.name.trim()) {
    const clash = await findProductByNameCi(tenantId, input.name, excludeId);
    if (clash) throw new Error("NAME_EXISTS");
  }
  if (input.barcode != null && input.barcode.trim()) {
    const clash = await findProductByBarcodeCi(tenantId, input.barcode, excludeId);
    if (clash) throw new Error("BARCODE_EXISTS");
  }
}

/** Import: SKU → nom bo‘yicha mavjud qatorni topish (dublikat yaratmaslik uchun) */
export async function resolveExistingProductForImport(
  tenantId: number,
  sku: string,
  name: string
) {
  if (sku.trim()) {
    const bySku = await findProductBySkuCi(tenantId, sku);
    if (bySku) return bySku;
  }
  if (name.trim()) {
    const byName = await findProductByNameCi(tenantId, name);
    if (byName) return byName;
  }
  return null;
}

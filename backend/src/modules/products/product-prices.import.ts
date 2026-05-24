import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidatePriceTypesCache } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

const DEFAULT_PRICE_TYPE = "retail";

function priceImportHeaderToKey(h: string): string | null {
  const n = h.trim().toLowerCase().replace(/\s+/g, "_");
  if (n === "sku" || n === "kod" || n.includes("артикул") || n === "artikul") return "sku";
  if (n === "price_type" || n === "tur" || n.includes("narx_turi")) return "price_type";
  if (n === "price" || n === "narxi" || n.includes("narx") || n === "summa") return "price";
  return null;
}

export async function importProductPricesFromXlsx(
  tenantId: number,
  buffer: Buffer | Uint8Array,
  actorUserId: number | null = null
): Promise<{ upserted: number; errors: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { upserted: 0, errors: ["Varaq topilmadi"] };
  }

  const headerRow = sheet.getRow(1);
  const colIndexByKey: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const v = cell.text?.trim();
    if (!v) return;
    const key = priceImportHeaderToKey(v);
    if (key) colIndexByKey[key] = colNumber;
  });

  if (!colIndexByKey.sku || !colIndexByKey.price) {
    return {
      upserted: 0,
      errors: ["Birinchi qatorda majburiy: SKU (kod) va narx (price / narxi). Ixtiyoriy: narx turi (price_type), default retail."]
    };
  }

  let upserted = 0;
  const errors: string[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const sku = String(row.getCell(colIndexByKey.sku).text ?? "").trim();
    const priceRaw = colIndexByKey.price ? row.getCell(colIndexByKey.price).value : null;
    const priceNum =
      typeof priceRaw === "number"
        ? priceRaw
        : Number.parseFloat(String(priceRaw ?? "").replace(/\s/g, "").replace(",", "."));
    const typeCell = colIndexByKey.price_type ? row.getCell(colIndexByKey.price_type).text : "";
    const price_type = String(typeCell ?? "").trim() || DEFAULT_PRICE_TYPE;

    if (!sku && !priceRaw) continue;
    if (!sku) {
      errors.push(`Qator ${r}: SKU bo‘sh`);
      continue;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      errors.push(`Qator ${r}: narx noto‘g‘ri`);
      continue;
    }

    try {
      const product = await prisma.product.findUnique({
        where: { tenant_id_sku: { tenant_id: tenantId, sku } }
      });
      if (!product) {
        errors.push(`Qator ${r}: SKU topilmadi (${sku})`);
        continue;
      }
      await prisma.productPrice.upsert({
        where: {
          tenant_id_product_id_price_type: {
            tenant_id: tenantId,
            product_id: product.id,
            price_type
          }
        },
        create: {
          tenant_id: tenantId,
          product_id: product.id,
          price_type,
          price: new Prisma.Decimal(priceNum)
        },
        update: { price: new Prisma.Decimal(priceNum) }
      });
      upserted += 1;
    } catch (e) {
      errors.push(`Qator ${r}: ${e instanceof Error ? e.message : "xato"}`);
    }
  }

  if (upserted > 0) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.product_price,
      entityId: "bulk",
      action: "import.xlsx",
      payload: { upserted, error_count: errors.length }
    });
    void invalidatePriceTypesCache(tenantId);
  }

  return { upserted, errors };
}

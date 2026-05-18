import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import type { StockRow } from "./stock.types";

const STOCK_LIST_BY_WH_TTL_SEC = 20;

export async function listStockForTenant(
  tenantId: number,
  warehouseId?: number | null,
  productIds?: number[] | null
): Promise<StockRow[]> {
  const wh = warehouseId != null && warehouseId > 0 ? warehouseId : null;
  const ids =
    Array.isArray(productIds) && productIds.length > 0
      ? productIds.filter((n) => Number.isInteger(n) && n > 0)
      : [];
  const useIds = ids.length > 0;

  // Katta cache key / ko‘p variantlar bo‘lmasin: scoped productIds bo‘lsa Redis cache ishlatmaymiz.
  const cacheKey = wh != null && !useIds ? `tenant:${tenantId}:stock:${wh}` : null;

  if (cacheKey) {
    try {
      const redis = await getRedisForApp();
      const hit = await redis.get(cacheKey);
      if (hit) {
        return JSON.parse(hit) as StockRow[];
      }
    } catch {
      /* Redis yo‘q */
    }
  }

  const rows = await prisma.stock.findMany({
    where: {
      tenant_id: tenantId,
      ...(warehouseId != null ? { warehouse_id: warehouseId } : {}),
      ...(useIds ? { product_id: { in: ids } } : {})
    },
    include: {
      product: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } }
    },
    orderBy: [{ warehouse_id: "asc" }, { product_id: "asc" }]
  });

  const out = rows.map((r) => ({
    id: r.id,
    warehouse_id: r.warehouse_id,
    warehouse_name: r.warehouse.name,
    product_id: r.product_id,
    sku: r.product.sku,
    product_name: r.product.name,
    qty: r.qty.toString(),
    reserved_qty: r.reserved_qty.toString()
  }));

  if (cacheKey) {
    try {
      const redis = await getRedisForApp();
      await redis.set(cacheKey, JSON.stringify(out), "EX", STOCK_LIST_BY_WH_TTL_SEC);
    } catch {
      /* ignore */
    }
  }

  return out;
}

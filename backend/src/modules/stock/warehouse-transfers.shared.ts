import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

type AssertTransferRow = {
  id: number;
  status: string;
  source_warehouse_id: number;
  destination_warehouse_id: number;
};

export async function assertTransferExists(
  tenantId: number,
  id: number
): Promise<AssertTransferRow> {
  const rows = await prisma.$queryRaw<AssertTransferRow[]>`
    SELECT id, status, source_warehouse_id, destination_warehouse_id
    FROM warehouse_transfers
    WHERE id = ${id} AND tenant_id = ${tenantId}
  `;
  const hit = rows[0];
  if (!hit) throw new Error("NOT_FOUND");
  return hit;
}

export async function assertWarehouseForTenant(tenantId: number, warehouseId: number): Promise<{ id: number; name: string }> {
  const wh = await prisma.$queryRaw<
    { id: number; name: string }[]
  >`SELECT id, name FROM warehouses WHERE id = ${warehouseId} AND tenant_id = ${tenantId}`;
  if (!wh[0]) throw new Error("BAD_WAREHOUSE");
  return wh[0];
}

export function validateWarehouseDisjoint(input: { source_warehouse_id: number; destination_warehouse_id: number }) {
  if (input.source_warehouse_id === input.destination_warehouse_id) {
    throw new Error("SAME_WAREHOUSE");
  }
}

/** Mavjud = qty − reserved_qty; ko‘chirish miqdori shundan oshmasin (draft yaratish / yangilash / start). */
export async function assertSourceStockForLines(
  tenantId: number,
  sourceWarehouseId: number,
  lines: { product_id: number; qty: number | Prisma.Decimal }[]
): Promise<void> {
  if (lines.length === 0) return;
  const productIds = [...new Set(lines.map((l) => l.product_id))];
  const products = await prisma.$queryRaw<
    { id: number; sku: string }[]
  >`SELECT id, sku FROM products WHERE id IN (${Prisma.join(
    productIds.map((pid) => Prisma.sql`${pid}`)
  )}) AND tenant_id = ${tenantId}`;
  if (products.length !== productIds.length) throw new Error("BAD_PRODUCT");

  for (const line of lines) {
    const delta = new Prisma.Decimal(line.qty);
    if (delta.lte(0)) throw new Error("BAD_QTY");

    const stock = await prisma.$queryRaw<
      { qty: Prisma.Decimal; reserved_qty: Prisma.Decimal }[]
    >`
      SELECT qty, reserved_qty FROM stock
      WHERE tenant_id = ${tenantId}
        AND warehouse_id = ${sourceWarehouseId}
        AND product_id = ${line.product_id}
    `;

    const available = stock[0]
      ? stock[0].qty.minus(stock[0].reserved_qty)
      : new Prisma.Decimal(0);

    if (available.lt(delta)) {
      const productInfo = products.find((p) => p.id === line.product_id);
      throw new Error(
        `INSUFFICIENT_STOCK:product=${productInfo?.sku ?? line.product_id}:need=${delta}:have=${available}`
      );
    }
  }
}

export function generateTransferNumber(id: number): string {
  return `WT-${String(id).padStart(6, "0")}`;
}

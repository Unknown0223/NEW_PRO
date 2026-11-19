import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { assertAvailable } from "./stock-reservation";

type AssertTransferRow = {
  id: number;
  status: string;
  kind: string;
  source_warehouse_id: number;
  destination_warehouse_id: number;
};

export async function assertTransferExists(
  tenantId: number,
  id: number
): Promise<AssertTransferRow> {
  const rows = await prisma.$queryRaw<AssertTransferRow[]>`
    SELECT id, status, kind, source_warehouse_id, destination_warehouse_id
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

/**
 * Thin adapter: transfer lines → StockReservation.assertAvailable.
 * reserved_qty yozilmaydi; API xato formati `INSUFFICIENT_STOCK:product=…` saqlanadi.
 */
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

  const needByProduct = new Map<number, Prisma.Decimal>();
  for (const line of lines) {
    const delta = new Prisma.Decimal(line.qty);
    if (delta.lte(0)) throw new Error("BAD_QTY");
    const cur = needByProduct.get(line.product_id) ?? new Prisma.Decimal(0);
    needByProduct.set(line.product_id, cur.add(delta));
  }

  try {
    await assertAvailable(prisma, {
      tenantId,
      warehouseId: sourceWarehouseId,
      needByProduct
    });
  } catch (e) {
    const err = e as Error & { product_id?: number; available?: string; requested?: string };
    if (err?.message === "INSUFFICIENT_STOCK" && err.product_id != null) {
      const productInfo = products.find((p) => p.id === err.product_id);
      throw new Error(
        `INSUFFICIENT_STOCK:product=${productInfo?.sku ?? err.product_id}:need=${err.requested ?? "?"}:have=${err.available ?? "?"}`
      );
    }
    throw e;
  }
}

export function generateTransferNumber(id: number): string {
  return `WT-${String(id).padStart(6, "0")}`;
}

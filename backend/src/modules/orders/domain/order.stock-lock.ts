import { Prisma } from "@prisma/client";

export type LockedStockRow = {
  product_id: number;
  qty: Prisma.Decimal;
  reserved_qty: Prisma.Decimal;
};

/**
 * Stock qatorlarini product_id tartibida FOR UPDATE.
 * Yo‘q qatorlar 0/0 bilan yaratiladi (deadlock oldini olish: id ASC).
 */
export async function lockStockRowsForUpdate(
  tx: Prisma.TransactionClient,
  args: { tenantId: number; warehouseId: number; productIds: number[] }
): Promise<Map<number, LockedStockRow>> {
  const sortedIds = [...new Set(args.productIds)].filter((id) => id > 0).sort((a, b) => a - b);
  const map = new Map<number, LockedStockRow>();
  if (sortedIds.length === 0) return map;

  for (const productId of sortedIds) {
    await tx.$executeRaw`
      INSERT INTO stock (tenant_id, warehouse_id, product_id, qty, reserved_qty, created_at, updated_at)
      VALUES (${args.tenantId}, ${args.warehouseId}, ${productId}, 0, 0, now(), now())
      ON CONFLICT (tenant_id, warehouse_id, product_id) DO NOTHING
    `;
  }

  const rows = await tx.$queryRaw<LockedStockRow[]>`
    SELECT product_id, qty, reserved_qty
    FROM stock
    WHERE tenant_id = ${args.tenantId}
      AND warehouse_id = ${args.warehouseId}
      AND product_id IN (${Prisma.join(sortedIds)})
    ORDER BY product_id
    FOR UPDATE
  `;

  for (const row of rows) {
    map.set(Number(row.product_id), {
      product_id: Number(row.product_id),
      qty: new Prisma.Decimal(row.qty),
      reserved_qty: new Prisma.Decimal(row.reserved_qty)
    });
  }
  return map;
}

export function throwInsufficientStock(
  productId: number,
  available: Prisma.Decimal,
  requested: Prisma.Decimal
): never {
  const err = new Error("INSUFFICIENT_STOCK") as Error & {
    product_id: number;
    available: string;
    requested: string;
  };
  err.product_id = productId;
  err.available = available.toString();
  err.requested = requested.toString();
  throw err;
}

/** Qulflangan stock bo‘yicha reserved_qty oshirish (create / parallel test). */
export async function reserveOutboundNeedMap(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: number;
    warehouseId: number;
    needByProduct: Map<number, Prisma.Decimal>;
  }
): Promise<void> {
  const productIds = [...args.needByProduct.keys()];
  if (productIds.length === 0) return;

  const stockMap = await lockStockRowsForUpdate(tx, {
    tenantId: args.tenantId,
    warehouseId: args.warehouseId,
    productIds
  });

  for (const [productId, needQty] of args.needByProduct) {
    const row = stockMap.get(productId);
    const qty = row?.qty ?? new Prisma.Decimal(0);
    const reservedRaw = row?.reserved_qty ?? new Prisma.Decimal(0);
    const reserved = reservedRaw.lt(0) ? new Prisma.Decimal(0) : reservedRaw;
    const available = qty.sub(reserved);
    if (available.lt(needQty)) {
      throwInsufficientStock(productId, available, needQty);
    }
  }

  for (const [productId, reserveQty] of args.needByProduct) {
    await tx.stock.update({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: args.tenantId,
          warehouse_id: args.warehouseId,
          product_id: productId
        }
      },
      data: { reserved_qty: { increment: reserveQty } }
    });
  }
}

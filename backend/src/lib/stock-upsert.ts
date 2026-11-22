import { Prisma } from "@prisma/client";

export async function upsertStock(
  tx: Prisma.TransactionClient,
  tenantId: number,
  warehouseId: number,
  productId: number,
  qty: Prisma.Decimal
): Promise<void> {
  await tx.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: { tenant_id: tenantId, warehouse_id: warehouseId, product_id: productId }
    },
    create: {
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      product_id: productId,
      qty,
      reserved_qty: new Prisma.Decimal(0)
    },
    update: { qty }
  });
}

export async function incrementStock(
  tx: Prisma.TransactionClient,
  tenantId: number,
  warehouseId: number,
  productId: number,
  delta: Prisma.Decimal
): Promise<Prisma.Decimal> {
  const stock = await tx.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: { tenant_id: tenantId, warehouse_id: warehouseId, product_id: productId }
    },
    create: {
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      product_id: productId,
      qty: delta,
      reserved_qty: new Prisma.Decimal(0)
    },
    update: { qty: { increment: delta } }
  });
  return stock.qty;
}

export async function decrementStock(
  tx: Prisma.TransactionClient,
  tenantId: number,
  warehouseId: number,
  productId: number,
  delta: Prisma.Decimal
): Promise<Prisma.Decimal> {
  if (!delta.gt(0)) {
    throw new Error("BAD_DELTA");
  }

  const existing = await tx.stock.findUnique({
    where: {
      tenant_id_warehouse_id_product_id: {
        tenant_id: tenantId,
        warehouse_id: warehouseId,
        product_id: productId
      }
    }
  });
  const before = existing?.qty ?? new Prisma.Decimal(0);
  if (before.lt(delta)) {
    throw new Error("NEGATIVE_QTY");
  }

  const stock = await tx.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: { tenant_id: tenantId, warehouse_id: warehouseId, product_id: productId }
    },
    create: {
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      product_id: productId,
      qty: new Prisma.Decimal(0),
      reserved_qty: new Prisma.Decimal(0)
    },
    update: { qty: { decrement: delta } }
  });
  if (stock.qty.lt(0)) {
    throw new Error("NEGATIVE_QTY");
  }
  return stock.qty;
}
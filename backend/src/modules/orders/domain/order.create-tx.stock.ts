import { Prisma } from "@prisma/client";
import type { CreateOrderPaidBundle } from "./order.create-tx.bonus";
import type { CreateOrderTxParams } from "./order.create-tx.types";

export async function reserveOutboundStockForCreateOrder(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams,
  paid: CreateOrderPaidBundle
): Promise<void> {
  const { tenantId, input, isInboundShelfReturn } = p;
  const { paidAfterDisc, bonusCreates } = paid;

  const whId = input.warehouse_id;
  const needByProduct = new Map<number, Prisma.Decimal>();
  const addNeed = (productId: number, q: Prisma.Decimal) => {
    const cur = needByProduct.get(productId) ?? new Prisma.Decimal(0);
    needByProduct.set(productId, cur.add(q));
  };
  if (isInboundShelfReturn) return;

  for (const l of paidAfterDisc) {
    if (l.exchange_line_kind === "minus") continue;
    addNeed(l.product_id, l.qty);
  }
  for (const b of bonusCreates) {
    addNeed(b.product_id, b.qty);
  }
  const stockProductIds = [...needByProduct.keys()];
  const stockRows = await tx.stock.findMany({
    where: { tenant_id: tenantId, warehouse_id: whId, product_id: { in: stockProductIds } },
    select: { product_id: true, qty: true, reserved_qty: true }
  });
  const stockMap = new Map(stockRows.map((s) => [s.product_id, s]));

  for (const [productId, needQty] of needByProduct) {
    const row = stockMap.get(productId);
    const qty = row?.qty ?? new Prisma.Decimal(0);
    const reserved = row?.reserved_qty ?? new Prisma.Decimal(0);
    const available = qty.sub(reserved);
    if (available.lt(needQty)) {
      const err = new Error("INSUFFICIENT_STOCK") as Error & {
        product_id: number;
        available: string;
        requested: string;
      };
      err.product_id = productId;
      err.available = available.toString();
      err.requested = needQty.toString();
      throw err;
    }
  }

  for (const [productId, reserveQty] of needByProduct) {
    await tx.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: whId,
          product_id: productId
        }
      },
      create: {
        tenant_id: tenantId,
        warehouse_id: whId,
        product_id: productId,
        reserved_qty: reserveQty
      },
      update: {
        reserved_qty: { increment: reserveQty }
      }
    });
  }
}

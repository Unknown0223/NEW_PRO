/**
 * Domain: Orders — create TX stock adapter.
 * Строки → needMap (inbound/bonus правила) → StockReservation.reserve.
 */
import { Prisma } from "@prisma/client";
import { reserve } from "../../stock/stock-reservation";
import type { CreateOrderPaidBundle } from "./order.create-tx.bonus";
import type { CreateOrderTxParams } from "./order.create-tx.types";

export async function reserveOutboundStockForCreateOrder(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams,
  paid: CreateOrderPaidBundle
): Promise<void> {
  const { tenantId, input, isInboundShelfReturn } = p;
  const { paidAfterDisc, bonusCreates } = paid;

  if (isInboundShelfReturn) return;

  const needByProduct = new Map<number, Prisma.Decimal>();
  const addNeed = (productId: number, q: Prisma.Decimal) => {
    const cur = needByProduct.get(productId) ?? new Prisma.Decimal(0);
    needByProduct.set(productId, cur.add(q));
  };

  for (const l of paidAfterDisc) {
    if (l.exchange_line_kind === "minus") continue;
    addNeed(l.product_id, l.qty);
  }
  for (const b of bonusCreates) {
    addNeed(b.product_id, b.qty);
  }

  await reserve(tx, {
    tenantId,
    warehouseId: input.warehouse_id,
    needByProduct
  });
}

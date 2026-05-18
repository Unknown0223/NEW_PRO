import { Prisma } from "@prisma/client";
import { resolveCreateOrderPaidBundle } from "./order.create-tx.bonus";
import { assertCreateOrderLimitsInTransaction } from "./order.create-tx.limits";
import { persistCreateOrderInTransaction } from "./order.create-tx.persist";
import { reserveOutboundStockForCreateOrder } from "./order.create-tx.stock";

export type { CreateOrderClientRow, CreateOrderTxParams } from "./order.create-tx.types";

export async function runCreateOrderTransaction(tx: Prisma.TransactionClient, p: import("./order.create-tx.types").CreateOrderTxParams) {
  const paid = await resolveCreateOrderPaidBundle(tx, p);
  const limits = await assertCreateOrderLimitsInTransaction(tx, p, paid.paidTotal);
  await reserveOutboundStockForCreateOrder(tx, p, paid);
  return persistCreateOrderInTransaction(tx, p, paid, limits);
}

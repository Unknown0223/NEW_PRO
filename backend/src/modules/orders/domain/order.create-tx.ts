import { Prisma } from "@prisma/client";
import { resolveCreateOrderPaidBundle } from "./order.create-tx.bonus";
import { assertCreateOrderLimitsInTransaction } from "./order.create-tx.limits";
import { persistCreateOrderInTransaction } from "./order.create-tx.persist";
import { reserveOutboundStockForCreateOrder } from "./order.create-tx.stock";
import { capBonusCreatesToStock, mergeOrderAutoComments } from "../order-bonus-stock-cap";
import {
  buildDiscountAlertComment,
  resolveDiscountAlertForCreate
} from "../order-discount-alert";

export type { CreateOrderClientRow, CreateOrderTxParams } from "./order.create-tx.types";

export async function runCreateOrderTransaction(tx: Prisma.TransactionClient, p: import("./order.create-tx.types").CreateOrderTxParams) {
  const paid = await resolveCreateOrderPaidBundle(tx, p);
  const stockCap = await capBonusCreatesToStock(
    tx,
    p.tenantId,
    p.input.warehouse_id,
    paid.paidAfterDisc,
    paid.bonusCreates
  );
  paid.bonusCreates = stockCap.bonusCreates;
  paid.bonusSum = stockCap.bonusSum;

  const discountRes = await resolveDiscountAlertForCreate(tx, p, paid);
  const discountComment =
    discountRes.alert != null
      ? buildDiscountAlertComment(discountRes.alert, {
          discountPct: discountRes.discountPct,
          expectedSum: discountRes.expectedSum,
          orderLabel: "заказ (новый)"
        })
      : null;

  const mergedComment = mergeOrderAutoComments(p.input.comment, [
    stockCap.shortageComment,
    discountComment
  ]);
  const inputWithComment = { ...p.input, comment: mergedComment };

  const limits = await assertCreateOrderLimitsInTransaction(tx, p, paid.paidTotal);
  await reserveOutboundStockForCreateOrder(tx, p, paid);
  return persistCreateOrderInTransaction(
    tx,
    { ...p, input: inputWithComment },
    paid,
    limits,
    discountRes.alert,
    stockCap.bonusAlert
  );
}

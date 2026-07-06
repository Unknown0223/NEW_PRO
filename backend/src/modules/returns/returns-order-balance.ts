import type { OrderItemSummary } from "./returns-enhanced.types";
import { Prisma } from "@prisma/client";
import { R, splitReturnLinePaidBonus } from "./returns-enhanced.helpers";

export type OrderReturnBalance = {
  order_id: number;
  initial_paid_qty: number;
  initial_bonus_qty: number;
  returned_paid_qty: number;
  returned_bonus_qty: number;
  remaining_paid_qty: number;
  remaining_bonus_qty: number;
  fully_returned: boolean;
};

function pieceQty(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n + 1e-9);
}

/** Zakaz pozitsiyalaridan pullik / bonus jami (butun шт). */
export function sumOrderItemQty(items: OrderItemSummary[]): { paid: number; bonus: number } {
  let paid = 0;
  let bonus = 0;
  for (const it of items) {
    const q = pieceQty(Number.parseFloat(String(it.qty).replace(/\s/g, "").replace(",", ".")));
    if (q <= 0) continue;
    if (it.is_bonus) bonus += q;
    else paid += q;
  }
  return { paid, bonus };
}

/** Po zakaz: qolgan pullik pozitsiyalar bo‘yicha maksimal pul qaytarish (refund_amount emas). */
export function computeOrderRemainingPaidRefundCap(items: OrderItemSummary[]): Prisma.Decimal {
  let refund = new Prisma.Decimal(0);
  for (const it of items) {
    if (it.is_bonus) continue;
    const q = pieceQty(Number.parseFloat(String(it.qty).replace(/\s/g, "").replace(",", ".")));
    const p = Number.parseFloat(String(it.price).replace(/\s/g, "").replace(",", "."));
    if (q <= 0 || !Number.isFinite(p)) continue;
    refund = refund.add(R(p).mul(q));
  }
  return refund;
}

export function assertOrderHasPhysicalRemaining(items: OrderItemSummary[]): void {
  const { paid, bonus } = sumOrderItemQty(items);
  if (paid <= 0 && bonus <= 0) throw new Error("ORDER_FULLY_RETURNED");
}

/** Oldingi posted qaytarishlar bo‘yicha qaytarilgan pullik / bonus. */
export function sumReturnedQtyFromReturns(
  orderId: number,
  returns: Array<{
    order_id: number | null;
    lines: Array<{
      product_id: number;
      qty: unknown;
      paid_qty?: unknown;
      bonus_qty?: unknown;
    }>;
  }>
): { paid: number; bonus: number } {
  let paid = 0;
  let bonus = 0;
  for (const ret of returns) {
    if (ret.order_id !== orderId) continue;
    for (const ln of ret.lines) {
      const split = splitReturnLinePaidBonus({
        product_id: ln.product_id,
        qty: ln.qty as string | number,
        paid_qty: ln.paid_qty as string | number | null | undefined,
        bonus_qty: ln.bonus_qty as string | number | null | undefined
      });
      paid += pieceQty(split.paid);
      bonus += pieceQty(split.bonus);
    }
  }
  return { paid, bonus };
}

/** Boshlang‘ich / qaytarilgan / qoldiq — bitta zakaz bo‘yicha. */
export function computeOrderReturnBalance(
  orderId: number,
  originalItems: OrderItemSummary[],
  remainingItems: OrderItemSummary[],
  returns: Array<{
    order_id: number | null;
    lines: Array<{
      product_id: number;
      qty: unknown;
      paid_qty?: unknown;
      bonus_qty?: unknown;
    }>;
  }>
): OrderReturnBalance {
  const scopedOriginal = originalItems.filter((i) => i.order_id === orderId);
  const scopedRemaining = remainingItems.filter((i) => i.order_id === orderId);
  const initial = sumOrderItemQty(scopedOriginal);
  const remaining = sumOrderItemQty(scopedRemaining);
  const returnedFromLines = sumReturnedQtyFromReturns(orderId, returns);
  const returnedPaid = Math.max(0, initial.paid - remaining.paid);
  const returnedBonus = Math.max(0, initial.bonus - remaining.bonus);
  const fullyReturned = remaining.paid <= 0 && remaining.bonus <= 0;

  return {
    order_id: orderId,
    initial_paid_qty: initial.paid,
    initial_bonus_qty: initial.bonus,
    returned_paid_qty: returnedPaid || returnedFromLines.paid,
    returned_bonus_qty: returnedBonus || returnedFromLines.bonus,
    remaining_paid_qty: remaining.paid,
    remaining_bonus_qty: remaining.bonus,
    fully_returned: fullyReturned
  };
}

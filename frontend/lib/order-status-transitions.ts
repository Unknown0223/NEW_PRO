/**
 * Backend `order-status.ts` bilan mos: dropdown guruhlari (reopen / orqaga / oldinga).
 */

import { ORDER_TYPE_VALUES } from "@/lib/order-types";

export type OrderStatusId =
  | "new"
  | "confirmed"
  | "picking"
  | "delivering"
  | "delivered"
  | "returned"
  | "cancelled";

export type OrderTypeId = (typeof ORDER_TYPE_VALUES)[number];

const RETURN_TYPES = new Set(["return", "return_by_order", "partial_return"]);

function normalizeOrderType(s: string | null | undefined): OrderTypeId {
  const t = (s ?? "order").trim();
  return (ORDER_TYPE_VALUES as readonly string[]).includes(t) ? (t as OrderTypeId) : "order";
}

const reverseByType: Record<OrderTypeId, Record<string, Set<string>>> = {
  order: {
    confirmed: new Set(["new"]),
    picking: new Set(["confirmed"]),
    delivering: new Set(["picking"]),
    delivered: new Set(["delivering"]),
    returned: new Set(["delivered"])
  },
  return: {
    confirmed: new Set(["new"]),
    picking: new Set(["confirmed"]),
    delivering: new Set(["confirmed", "picking"]),
    delivered: new Set(["delivering"]),
    returned: new Set(["delivered"])
  },
  exchange: {
    confirmed: new Set(["new"]),
    picking: new Set(["confirmed"]),
    delivering: new Set(["picking"]),
    delivered: new Set(["delivering"]),
    returned: new Set(["delivered"])
  },
  partial_return: {
    confirmed: new Set(["new"]),
    picking: new Set(["confirmed"]),
    delivering: new Set(["picking"]),
    delivered: new Set(["delivering"]),
    returned: new Set(["delivered"])
  },
  return_by_order: {
    confirmed: new Set(["new"]),
    picking: new Set(["confirmed"]),
    delivering: new Set(["confirmed", "picking"]),
    delivered: new Set(["delivering"]),
    returned: new Set(["delivered"])
  }
};

export function isReopenCancelledTransition(from: string, to: string): boolean {
  return from === "cancelled" && to === "new";
}

export function isBackwardOrderStatusTransition(
  from: string,
  to: string,
  orderType: string | null | undefined
): boolean {
  if (isReopenCancelledTransition(from, to)) return false;
  const type = normalizeOrderType(orderType);
  const rev = reverseByType[type][from];
  return rev != null && rev.has(to);
}

export function reopenStatusLabel(orderType: string | null | undefined): string {
  return RETURN_TYPES.has(normalizeOrderType(orderType))
    ? "Вернуть в Новый возврат"
    : "Вернуть в Новый";
}

export function reopenConfirmMessage(orderType: string | null | undefined): string {
  return RETURN_TYPES.has(normalizeOrderType(orderType))
    ? "Восстановить возврат в статус «Новый возврат»?"
    : "Восстановить заказ в статус «Новый»?";
}

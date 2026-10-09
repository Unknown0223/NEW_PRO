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

export const ORDER_STATUS_TARGET_PERMISSION: Record<string, string> = {
  confirmed: "orders.status_confirmed.status",
  picking: "orders.status_picking.status",
  delivering: "orders.status_delivering.status",
  delivered: "orders.status_delivered.status",
  returned: "orders.status_returned.status",
  cancelled: "orders.status_cancelled.status"
};

export const ORDER_STATUS_REVERT_PERMISSION = "orders.status_revert.status";
export const ORDER_STATUS_REOPEN_PERMISSION = "orders.status_reopen.status";
export const ORDER_STATUS_DATE_PERMISSION = "orders.status_date.update";

/** Statusni o'zgartiruvchi barcha kalitlar (Доступ → Заявки → Статус). */
export const ORDER_STATUS_CHANGE_PERMISSIONS: readonly string[] = [
  ...Object.values(ORDER_STATUS_TARGET_PERMISSION),
  ORDER_STATUS_REVERT_PERMISSION,
  ORDER_STATUS_REOPEN_PERMISSION
];

/** Backend `orderStatusTransitionPermission` bilan bir xil: `from → to` uchun kerakli kalit. */
export function orderStatusTransitionPermission(
  from: string,
  to: string,
  orderType: string | null | undefined
): string | null {
  if (isReopenCancelledTransition(from, to)) return ORDER_STATUS_REOPEN_PERMISSION;
  if (isBackwardOrderStatusTransition(from, to, orderType)) return ORDER_STATUS_REVERT_PERMISSION;
  return ORDER_STATUS_TARGET_PERMISSION[to] ?? null;
}

/**
 * Guruh panelida maqsad statusni ko'rsatish mumkinmi (aniq o'tish har zakaz uchun serverda tekshiriladi):
 * «Новый» — faqat orqaga qadam yoki tiklash orqali; boshqalar — maqsad kaliti yoki orqaga qadam.
 */
export function canPickBulkTargetStatus(target: string, has: (key: string) => boolean): boolean {
  if (target === "new") return has(ORDER_STATUS_REVERT_PERMISSION) || has(ORDER_STATUS_REOPEN_PERMISSION);
  const key = ORDER_STATUS_TARGET_PERMISSION[target];
  if (!key) return false;
  return has(key) || (target !== "cancelled" && has(ORDER_STATUS_REVERT_PERMISSION));
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

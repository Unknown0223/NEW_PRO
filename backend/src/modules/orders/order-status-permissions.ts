import { isBackwardTransition, isReopenCancelledTransition, normalizeOrderType } from "./order-status";

/**
 * Har bir status o'tishi — alohida ruxsat (Доступ → Заявки → Статус).
 * Oldinga o'tish maqsad status bo'yicha; orqaga bir qadam va bekorni tiklash — umumiy kalitlar.
 */
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

/** Statusni o'zgartiruvchi barcha kalitlar (route guard: kamida bittasi kerak). */
export const ORDER_STATUS_CHANGE_PERMISSIONS: readonly string[] = [
  ...Object.values(ORDER_STATUS_TARGET_PERMISSION),
  ORDER_STATUS_REVERT_PERMISSION,
  ORDER_STATUS_REOPEN_PERMISSION
];

/** `from → to` o'tishi uchun talab qilinadigan kalit (noma'lum maqsad — null). */
export function orderStatusTransitionPermission(from: string, to: string, orderType?: string | null): string | null {
  if (isReopenCancelledTransition(from, to)) return ORDER_STATUS_REOPEN_PERMISSION;
  if (isBackwardTransition(from, to, normalizeOrderType(orderType))) return ORDER_STATUS_REVERT_PERMISSION;
  return ORDER_STATUS_TARGET_PERMISSION[to] ?? null;
}

/** Status o'tishini ruxsat bo'yicha tekshiruvchi (null — cheklov yo'q: admin yoki RBAC o'chiq). */
export type OrderStatusPermissionChecker = (from: string, to: string, orderType?: string | null) => boolean;

export function buildOrderStatusPermissionChecker(keys: ReadonlySet<string>): OrderStatusPermissionChecker {
  return (from, to, orderType) => {
    const key = orderStatusTransitionPermission(from, to, orderType);
    return key != null && keys.has(key);
  };
}

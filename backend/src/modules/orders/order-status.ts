/**
 * Zakaz holatlari va hujjat tiplari bo‘yicha status zanjirlari.
 */

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "picking",
  "delivering",
  "delivered",
  "returned",
  "cancelled"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ─── Hujjat tiplari ────────────────────────────────────────────────────────

export const ORDER_TYPES = [
  "order",
  "return",
  "exchange",
  "partial_return",
  "return_by_order"
] as const;

export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  order: "Заказ",
  return: "Возврат с полки",
  exchange: "Обмен",
  partial_return: "Заказ с частичным возвратом",
  return_by_order: "Возврат с полки по заказу"
};

// ─── Status chains per order type (oldinga) ─────────────────────────────────

const forwardTransitionsByType: Record<OrderType, Record<string, Set<string>>> = {
  order: {
    new: new Set(["confirmed", "cancelled"]),
    confirmed: new Set(["picking", "cancelled"]),
    picking: new Set(["delivering", "cancelled"]),
    delivering: new Set(["delivered", "cancelled"]),
    delivered: new Set(["returned"]),
    returned: new Set(["cancelled"]),
    cancelled: new Set(["new"])
  },
  return: {
    new: new Set(["confirmed", "cancelled"]),
    confirmed: new Set(["delivering", "cancelled"]),
    picking: new Set(["delivering", "cancelled"]),
    delivering: new Set(["delivered", "cancelled"]),
    delivered: new Set(["returned"]),
    returned: new Set(),
    cancelled: new Set(["new"])
  },
  exchange: {
    new: new Set(["confirmed", "cancelled"]),
    confirmed: new Set(["picking", "cancelled"]),
    picking: new Set(["delivering", "cancelled"]),
    delivering: new Set(["delivered", "cancelled"]),
    delivered: new Set(["returned"]),
    returned: new Set(),
    cancelled: new Set(["new"])
  },
  partial_return: {
    new: new Set(["confirmed", "cancelled"]),
    confirmed: new Set(["picking", "cancelled"]),
    picking: new Set(["delivering", "cancelled"]),
    delivering: new Set(["delivered", "cancelled"]),
    delivered: new Set(["returned"]),
    returned: new Set(),
    cancelled: new Set(["new"])
  },
  return_by_order: {
    new: new Set(["confirmed", "cancelled"]),
    confirmed: new Set(["delivering", "cancelled"]),
    picking: new Set(["delivering", "cancelled"]),
    delivering: new Set(["delivered", "cancelled"]),
    delivered: new Set(["returned"]),
    returned: new Set(),
    cancelled: new Set(["new"])
  }
};

/** Bir qadam orqaga — hujjat tipi bo‘yicha (cancelled→new alohida forward). */
const reverseTransitionsByType: Record<OrderType, Record<string, Set<string>>> = {
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

// ─── Helpers ────────────────────────────────────────────────────────────────

export function forwardTransitionsForType(type: OrderType): Record<string, Set<string>> {
  return forwardTransitionsByType[type] ?? forwardTransitionsByType.order;
}

export function reverseTransitionsForType(type: OrderType): Record<string, Set<string>> {
  return reverseTransitionsByType[type] ?? reverseTransitionsByType.order;
}

export function isValidOrderStatus(s: string): s is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(s);
}

export function isValidOrderType(s: string): s is OrderType {
  return (ORDER_TYPES as readonly string[]).includes(s);
}

export function normalizeOrderType(s: string | undefined | null): OrderType {
  if (!s || !isValidOrderType(s)) return "order";
  return s;
}

/** Bekor qilingan zakazni qayta «Новый» ga ochish (reverse emas). */
export function isReopenCancelledTransition(from: string, to: string): boolean {
  return from === "cancelled" && to === "new";
}

export function canTransitionOrderStatus(
  from: string,
  to: string,
  orderType?: OrderType
): boolean {
  const type = normalizeOrderType(orderType);
  if (from === to) return false;
  if (!isValidOrderStatus(to)) return false;
  const fwd = forwardTransitionsForType(type)[from];
  if (fwd != null && fwd.has(to)) return true;
  const rev = reverseTransitionsForType(type)[from];
  return rev != null && rev.has(to);
}

/** Zanjirda orqaga bir qadam (cancelled→new emas). */
export function isBackwardTransition(
  from: string,
  to: string,
  orderType?: OrderType
): boolean {
  if (!isValidOrderStatus(from) || !isValidOrderStatus(to)) return false;
  if (isReopenCancelledTransition(from, to)) return false;
  const type = normalizeOrderType(orderType);
  const rev = reverseTransitionsForType(type)[from];
  return rev != null && rev.has(to);
}

/**
 * Ombor / «Отгружен» bosqichida `cancelled` — faqat **admin** (`orders.service`).
 */
export const ORDER_STATUSES_OPERATOR_CANNOT_CANCEL_FROM = new Set(["picking", "delivering"]);

export function isOperatorLateStageCancelForbidden(from: string, to: string): boolean {
  return to === "cancelled" && ORDER_STATUSES_OPERATOR_CANNOT_CANCEL_FROM.has(from);
}

const ROLES_MAY_REVERT_ONE_STEP = new Set(["admin", "operator", "supervisor"]);

export function mayActorRevertOneStep(actorRole: string): boolean {
  return ROLES_MAY_REVERT_ONE_STEP.has(actorRole);
}

export function getAllowedNextStatuses(
  from: string,
  options?: { omitBackward?: boolean; orderType?: OrderType }
): string[] {
  const type = normalizeOrderType(options?.orderType);
  const fwd = forwardTransitionsForType(type)[from]
    ? [...forwardTransitionsForType(type)[from]]
    : [];
  const rev = reverseTransitionsForType(type)[from]
    ? [...reverseTransitionsForType(type)[from]]
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...fwd, ...rev]) {
    if (options?.omitBackward && isBackwardTransition(from, s, type)) continue;
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * Kredit limiti / «ochiq yuk» (ombor oldi): bekor va qaytgan zakazlar summaga kirmaydi;
 * `new` … `delivering` gacha — hali yetkazilmagan majburiyat sifatida qatnashadi.
 */
export const ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE = ["cancelled", "returned"] as const;

/**
 * Debitor qarz — **faqat savdo zakazi** (`order_type === "order"`) va **faqat** `delivered`.
 */
export const ORDER_STATUSES_OUTSTANDING_RECEIVABLE = ["delivered"] as const;

const receivableSet = new Set<string>(ORDER_STATUSES_OUTSTANDING_RECEIVABLE);

export function statusContributesToDeliveredReceivableDebt(
  status: string,
  orderType?: string
): boolean {
  if (!orderTypeHasTradeReceivableDebtSemantics(orderType)) return false;
  return receivableSet.has(status);
}

export function orderTypeHasTradeReceivableDebtSemantics(orderType: string | undefined | null): boolean {
  return normalizeOrderType(orderType) === "order";
}

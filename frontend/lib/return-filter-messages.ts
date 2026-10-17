export type ReturnFilterMetaView = {
  period_from: string | null;
  balance_zero_at: string | null;
  empty_reason: "balance_zero_not_in_period" | "balance_zero_required" | null;
  period_enabled: boolean;
  balance_zero_enabled: boolean;
  filter_mode?: "period_only" | "balance_zero_only" | "period_and_balance_zero" | "none";
  client_balance?: string | null;
  ledger_balance?: string | null;
  unpaid_delivered_total?: string | null;
  ledger_net_balance?: string | null;
  delivered_in_period?: number | null;
  delivered_after_filter?: number;
  min_order_created_at?: string | null;
  explanation?: string;
  log?: string[];
};

/** Po zakaz / erkin: filtr sababli yoki qoldiq yo‘qligi xabari. */
export function polkiReturnEmptyListMessage(input: {
  filterMeta?: ReturnFilterMetaView | null;
  deliveredOrdersCount: number;
  returnableCount: number;
  isByOrder: boolean;
}): string {
  const { filterMeta, deliveredOrdersCount, returnableCount, isByOrder } = input;

  if (filterMeta?.empty_reason === "balance_zero_not_in_period") {
    return "Фильтр возврата: в периоде не найден нулевой баланс.";
  }

  if (filterMeta?.empty_reason) {
    return "По фильтру возврата подходящих заказов нет.";
  }

  if (deliveredOrdersCount > 0 && returnableCount === 0) {
    if (filterMeta?.period_enabled || filterMeta?.balance_zero_enabled) {
      return isByOrder
        ? "Доставленные заказы есть, но из-за фильтра или полного возврата список выбора пуст."
        : "По фильтру подходящих заказов не найдено или остаток равен 0.";
    }
    return "Все доставленные заказы полностью возвращены — остатка нет.";
  }

  return isByOrder
    ? "Доставленных заказов нет. Сначала переведите заказ в статус «Доставлен»."
    : "Нет открытого остатка для возврата.";
}

export function returnFilterModeLabel(
  mode: ReturnFilterMetaView["filter_mode"]
): string {
  switch (mode) {
    case "period_only":
      return "Только период";
    case "balance_zero_only":
      return "Только баланс 0";
    case "period_and_balance_zero":
      return "Период + баланс 0";
    case "none":
      return "Без фильтра";
    default:
      return "—";
  }
}

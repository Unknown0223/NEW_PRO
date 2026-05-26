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
    return "Qaytarish filtri: davr ichida balans 0 topilmadi.";
  }

  if (filterMeta?.empty_reason) {
    return "Qaytarish filtri bo‘yicha mos zakazlar yo‘q.";
  }

  if (deliveredOrdersCount > 0 && returnableCount === 0) {
    if (filterMeta?.period_enabled || filterMeta?.balance_zero_enabled) {
      return isByOrder
        ? "Yetkazilgan zakazlar bor, lekin filtr yoki to‘liq qaytarish tufayli tanlash ro‘yxati bo‘sh."
        : "Filtr bo‘yicha mos zakazlar topilmadi yoki qoldiq 0.";
    }
    return "Barcha yetkazilgan zakazlar to‘liq qaytarilgan — qoldiq yo‘q.";
  }

  return isByOrder
    ? "Yetkazilgan zakazlar yo‘q. Avval zakazni yetkazilgan holatga o‘tkazing."
    : "Qaytarish uchun ochiq qoldiq yo‘q.";
}

export function returnFilterModeLabel(
  mode: ReturnFilterMetaView["filter_mode"]
): string {
  switch (mode) {
    case "period_only":
      return "Faqat davr";
    case "balance_zero_only":
      return "Faqat balans 0";
    case "period_and_balance_zero":
      return "Davr + balans 0";
    case "none":
      return "Filtr yo‘q";
    default:
      return "—";
  }
}

/** Polki qaytarish: `return` (erkin) va `return_by_order` (zakaz bo‘yicha). */

export type PolkiReturnMode = "free" | "by_order";

export function polkiReturnModeFromType(orderType: string | undefined): PolkiReturnMode {
  return orderType?.trim() === "return_by_order" ? "by_order" : "free";
}

export const POLKI_RETURN_MODE_META = {
  free: {
    title: "Создать возврат с полки",
    shortLabel: "Возврат с полки",
    bannerLead:
      "Свободный возврат: все доставленные продажи клиента в одном документе. Заказы отдельно не отмечаются — состав собирается по категориям и строкам таблицы.",
    ordersListTitle: "Заказы клиента",
    ordersListHint: "Справочно: какие доставленные заказы есть у клиента. Выбор заказа не требуется.",
    showOrderCheckboxes: false,
    showOrdersList: false,
    showSkidkaType: false,
    showLegacyBonusCalc: false,
    showPolkiBonusMode: false,
    showAutoBonusBlock: true,
    groupLinesByOrder: false,
    requireOrderSelection: false
  },
  by_order: {
    title: "Возврат с полки по заказу",
    shortLabel: "По заказу",
    bannerLead:
      "Возврат по одному доставленному заказу. Выберите заказ справа — в таблице укажите количество к возврату; оплата и бонус распределяются автоматически.",
    ordersListTitle: "Выбор заказа",
    ordersListHint: "Обязательно: выберите один доставленный заказ для возврата.",
    showOrderCheckboxes: true,
    showOrdersList: true,
    showSkidkaType: true,
    showLegacyBonusCalc: false,
    showPolkiBonusMode: true,
    showAutoBonusBlock: true,
    groupLinesByOrder: true,
    requireOrderSelection: true
  }
} as const;

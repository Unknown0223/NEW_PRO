import { ORDER_STATUS_LABELS } from "@/lib/order-status";

const RETURN_TYPES = new Set(["return", "return_by_order", "partial_return"]);

/** Qaytarish hujjatlari — shablon uslubidagi holat nomlari. */
const RETURN_STATUS_LABELS: Record<string, string> = {
  new: "Новый возврат",
  confirmed: "Подтвержден к возврату",
  picking: "Комплектация возврата",
  delivering: "Возврат отгружен",
  delivered: "Возврат доставлен",
  returned: "В процессе возврата",
  cancelled: "Возврат отменен"
};

export function isReturnOrderType(orderType: string | null | undefined): boolean {
  const t = orderType?.trim() ?? "order";
  return RETURN_TYPES.has(t);
}

export function orderListStatusLabel(
  status: string,
  orderType: string | null | undefined
): string {
  if (isReturnOrderType(orderType)) {
    return RETURN_STATUS_LABELS[status] ?? ORDER_STATUS_LABELS[status] ?? status;
  }
  return ORDER_STATUS_LABELS[status] ?? status;
}

/** Holat ranglari — shablon jadvali. */
export function orderListStatusStyle(
  status: string,
  orderType: string | null | undefined
): { bg: string; text: string; border: string } {
  if (isReturnOrderType(orderType)) {
    const returnStyles: Record<string, { bg: string; text: string; border: string }> = {
      new: { bg: "#bae6fd", text: "#0369a1", border: "#7dd3fc" },
      confirmed: { bg: "#fef08a", text: "#854d0e", border: "#fde047" },
      picking: { bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe" },
      delivering: { bg: "#fed7aa", text: "#9a3412", border: "#fdba74" },
      delivered: { bg: "#bbf7d0", text: "#166534", border: "#86efac" },
      // «В процессе возврата» — «Отгружен» bilan bir xil rang (to'q sariq).
      returned: { bg: "#fed7aa", text: "#9a3412", border: "#fdba74" },
      cancelled: { bg: "#e5e7eb", text: "#4b5563", border: "#d1d5db" }
    };
    return returnStyles[status] ?? returnStyles.new;
  }
  const base: Record<string, { bg: string; text: string; border: string }> = {
    new: { bg: "#bae6fd", text: "#0369a1", border: "#7dd3fc" },
    confirmed: { bg: "#fef08a", text: "#854d0e", border: "#fde047" },
    picking: { bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe" },
    delivering: { bg: "#fed7aa", text: "#9a3412", border: "#fdba74" },
    delivered: { bg: "#bbf7d0", text: "#166534", border: "#86efac" },
    returned: { bg: "#f9a8d4", text: "#9d174d", border: "#f472b6" },
    cancelled: { bg: "#e5e7eb", text: "#4b5563", border: "#d1d5db" }
  };
  return base[status] ?? base.new;
}

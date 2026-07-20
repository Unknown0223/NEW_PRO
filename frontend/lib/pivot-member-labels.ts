import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { ORDER_TYPE_LABELS } from "@/lib/order-types";

/**
 * Pivot o‘lchov qiymatlari (filter / header) — tizim UI bilan bir xil ruscha yorliq.
 * Filtr qiymati API kodi bo‘lib qoladi (`new`); faqat ko‘rinish «Новый».
 */
const FIELD_MEMBER_LABELS: Record<string, Record<string, string>> = {
  order_status: ORDER_STATUS_LABELS,
  status: ORDER_STATUS_LABELS,
  order_type: ORDER_TYPE_LABELS as Record<string, string>
};

export function formatPivotMemberLabel(
  fieldId: string | undefined | null,
  value: string | number | null | undefined
): string {
  if (value == null) return "";
  const raw = String(value);
  if (!fieldId) return raw;
  const map = FIELD_MEMBER_LABELS[fieldId];
  if (!map) return raw;
  return map[raw] ?? map[raw.toLowerCase()] ?? raw;
}

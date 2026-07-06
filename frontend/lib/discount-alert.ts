export const DISCOUNT_ALERT_CODES = ["not_applied", "cash_desk_missing", "bonus_required"] as const;
export type DiscountAlertCode = (typeof DISCOUNT_ALERT_CODES)[number];

export const DISCOUNT_ALERT_LABELS: Record<DiscountAlertCode, string> = {
  not_applied: "Скидка не применена",
  cash_desk_missing: "Касса для скидки не настроена",
  bonus_required: "Для скидки нужен связанный бонус"
};

export const DISCOUNT_ALERT_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Все заявки" },
  { value: "any", label: "Проблемы со скидкой" },
  { value: "not_applied", label: DISCOUNT_ALERT_LABELS.not_applied },
  { value: "cash_desk_missing", label: DISCOUNT_ALERT_LABELS.cash_desk_missing },
  { value: "bonus_required", label: DISCOUNT_ALERT_LABELS.bonus_required }
];

export function discountAlertLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return DISCOUNT_ALERT_LABELS[code as DiscountAlertCode] ?? code;
}

export function isDiscountAlertCode(v: string): v is DiscountAlertCode {
  return (DISCOUNT_ALERT_CODES as readonly string[]).includes(v);
}

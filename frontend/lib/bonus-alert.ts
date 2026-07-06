export const BONUS_ALERT_CODES = ["stock_shortage"] as const;
export type BonusAlertCode = (typeof BONUS_ALERT_CODES)[number];

export const BONUS_ALERT_LABELS: Record<BonusAlertCode, string> = {
  stock_shortage: "Недостаточно бонуса на складе"
};

export function bonusAlertLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return BONUS_ALERT_LABELS[code as BonusAlertCode] ?? code;
}

export const BONUS_ALERT_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Все заявки" },
  { value: "any", label: "Проблемы с бонусом" },
  { value: "stock_shortage", label: BONUS_ALERT_LABELS.stock_shortage }
];

export const ORDER_ALERT_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Все заявки" },
  { value: "any", label: "Проблемные (бонус или скидка)" }
];

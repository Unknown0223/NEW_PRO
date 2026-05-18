/** Tanlangan qiymatlar `mobile_config.orders` va mobil kontrakt uchun barqaror kodlar. */

export const CONSIGNMENT_PAYMENT_DUE_OPTIONS = [
  {
    value: "days_from_order_date",
    label: "Количество дней от даты заказа"
  },
  {
    value: "last_day_of_this_month",
    label: "Последний день этого месяца"
  },
  {
    value: "first_day_next_month",
    label: "Первый день следующего месяца"
  },
  {
    value: "specific_day_next_month",
    label: "Определенный день следующего месяца"
  }
] as const;

export const BONUS_FILL_MODE_OPTIONS = [
  {
    value: "free",
    label: "Свободное заполнение (без ограничения)"
  },
  {
    value: "all_required",
    label: "Заполнение всех бонусов обязательно"
  },
  {
    value: "auto_fill_remaining",
    label: "Авто заполнение остаток бонусов"
  }
] as const;

export type ConsignmentPaymentDueRuleValue = (typeof CONSIGNMENT_PAYMENT_DUE_OPTIONS)[number]["value"];
export type BonusFillModeValue = (typeof BONUS_FILL_MODE_OPTIONS)[number]["value"];

export function labelForConsignmentRule(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return CONSIGNMENT_PAYMENT_DUE_OPTIONS.find((o) => o.value === value)?.label;
}

export function labelForBonusFillMode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return BONUS_FILL_MODE_OPTIONS.find((o) => o.value === value)?.label;
}

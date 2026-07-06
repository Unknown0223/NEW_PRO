/** «Балансы клиентов» — skidka ustuni; backend `DISCOUNT_SETTLEMENT_PAYMENT_LABEL` bilan bir xil. */
export const DISCOUNT_SETTLEMENT_PAYMENT_LABEL = "Оплата скидки";

export function isDiscountSettlementPaymentLabel(label: string): boolean {
  return label.trim().toLowerCase() === DISCOUNT_SETTLEMENT_PAYMENT_LABEL.toLowerCase();
}

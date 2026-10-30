/** UI (shablon) → backend `date_type` query. */
export type FinanceDateTypeUi = "order" | "shipment" | "delivery" | "created";

export const FINANCE_DATE_TYPE_OPTIONS: { value: FinanceDateTypeUi; label: string }[] = [
  { value: "order", label: "Дата заказа" },
  { value: "shipment", label: "Дата отправки" },
  { value: "delivery", label: "Дата доставки" },
  { value: "created", label: "Дата создания" }
];

export function financeDateTypeToApi(
  ui: FinanceDateTypeUi
): "created_at" | "shipped_at" | "delivered_at" {
  if (ui === "delivery") return "delivered_at";
  if (ui === "shipment") return "shipped_at";
  return "created_at";
}

export function financeDateTypeFromApi(
  api: "created_at" | "shipped_at" | "delivered_at"
): FinanceDateTypeUi {
  if (api === "delivered_at") return "delivery";
  if (api === "shipped_at") return "shipment";
  return "order";
}

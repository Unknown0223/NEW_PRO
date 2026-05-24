/** UI (shablon) → backend `date_type` query. */
export type FinanceDateTypeUi = "order" | "shipment" | "delivery" | "created";

export const FINANCE_DATE_TYPE_OPTIONS: { value: FinanceDateTypeUi; label: string }[] = [
  { value: "order", label: "Дата заказа" },
  { value: "shipment", label: "Дата отправки" },
  { value: "delivery", label: "Дата доставки" },
  { value: "created", label: "Дата создания" }
];

export function financeDateTypeToApi(ui: FinanceDateTypeUi): "created_at" | "delivered_at" {
  return ui === "delivery" ? "delivered_at" : "created_at";
}

export function financeDateTypeFromApi(api: "created_at" | "delivered_at"): FinanceDateTypeUi {
  return api === "delivered_at" ? "delivery" : "order";
}

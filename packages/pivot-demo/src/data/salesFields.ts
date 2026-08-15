import type { PivotField } from "@salec/pivot-engine";

export const SALES_FIELDS: PivotField[] = [
  { id: "dealer_name", label: "Дилер", dataType: "string" },
  { id: "region", label: "Регион", dataType: "string" },
  { id: "product_name", label: "Товар", dataType: "string" },
  { id: "category", label: "Категория", dataType: "string" },
  { id: "sale_date", label: "Дата", dataType: "date" },
  { id: "sale_year", label: "Год", dataType: "string" },
  { id: "sale_month", label: "Месяц", dataType: "string" },
  { id: "sale_quarter", label: "Квартал", dataType: "string" },
  {
    id: "quantity",
    label: "Количество (шт.)",
    dataType: "number",
    format: { type: "number", decimals: 0 }
  },
  {
    id: "amount",
    label: "Сумма (UZS)",
    dataType: "currency",
    format: { type: "currency", currency: "UZS", decimals: 0 }
  },
  {
    id: "bonus",
    label: "Бонус (UZS)",
    dataType: "currency",
    format: { type: "currency", currency: "UZS", decimals: 0 }
  }
];

export const DEFAULT_DEMO_CONFIG = {
  rows: ["dealer_name"],
  columns: ["sale_quarter"],
  reportFilters: [] as string[],
  values: [
    { fieldId: "amount", aggregation: "SUM" as const },
    { fieldId: "quantity", aggregation: "SUM" as const }
  ]
};

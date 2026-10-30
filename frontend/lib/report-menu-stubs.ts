/** SalesDoc «Отчёты» menyusida bor, loyihada hali ishlamagan sahifalar. */
export const REPORT_MENU_STUBS: Array<{ slug: string; label: string }> = [
  { slug: "client-sales-3", label: "Продажи по клиентам 3" },
  { slug: "order-qty", label: "Отчет по количеству заказов" },
  { slug: "sku-3", label: "По Sku 3.0" },
  { slug: "expeditor-shipments", label: "Отгрузки по экспедиторам" },
  { slug: "shelf-returns", label: "Отчет по возвратам (возврат с полки)" },
  { slug: "excel-export", label: "Excel экспорт" },
  { slug: "inventory", label: "По инвентарю" },
  { slug: "photo", label: "Фотоотчёты" },
  { slug: "tasks", label: "Отчёт по задачам" },
  { slug: "feedback", label: "Отчёт обратной связи (бот акт сверки)" },
  { slug: "nr", label: "НР отчёты" },
  { slug: "bonuses", label: "По бонусам" },
  { slug: "cumulative-bonus", label: "Накопительный бонус" },
  { slug: "visits", label: "По визитам" },
  { slug: "daily-visits", label: "По дневному посещению" },
  { slug: "prices", label: "По ценам" },
  { slug: "tare", label: "По тарам" },
  { slug: "outlet-class", label: "Классификация торговых точек" },
  { slug: "expeditor-visits", label: "Визиты экспедиторов" },
  { slug: "universal-returns", label: "Универсальный отчет по возвратам" },
  { slug: "universal-bonuses", label: "Универсальный отчет по бонусам" },
  { slug: "universal-visits", label: "Универсальный отчет по посещениям" },
  { slug: "universal-discounts", label: "Универсальный отчет по скидкам" },
  { slug: "universal-sales", label: "Универсальный отчёт по продажам" },
  { slug: "discount-detail", label: "Детальный отчет по скидкам" },
  { slug: "rfm", label: "RFM" },
  { slug: "balance-control", label: "Контроль балансов" },
  { slug: "expeditor-share", label: "Доли по экспедиторам" },
  { slug: "sales-compare", label: "Сравнительный анализ продаж" }
];

export function reportStubTitle(slug: string) {
  return REPORT_MENU_STUBS.find((x) => x.slug === slug)?.label ?? "Отчёт";
}

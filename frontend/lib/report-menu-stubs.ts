/** SalesDoc «Отчёты» menyusida bor, loyihada hali ishlamagan sahifalar. */
export const REPORT_MENU_STUBS: Array<{ slug: string; label: string }> = [
  { slug: "feedback", label: "Отчёт обратной связи (бот акт сверки)" },
  { slug: "nr", label: "НР отчёты" },
  { slug: "tare", label: "По тарам" },
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

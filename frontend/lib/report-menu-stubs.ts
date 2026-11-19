/** SalesDoc «Отчёты» menyusida bor, loyihada hali ishlamagan sahifalar. */
export const REPORT_MENU_STUBS: Array<{ slug: string; label: string }> = [
  { slug: "feedback", label: "Отчёт обратной связи (бот акт сверки)" },
  { slug: "nr", label: "НР отчёты" },
  { slug: "tare", label: "По тарам" }
];

export function reportStubTitle(slug: string) {
  return REPORT_MENU_STUBS.find((x) => x.slug === slug)?.label ?? "Отчёт";
}

/** SalesDoc «Отчёты» leftovers without a SALEC domain — permanently deferred. */
export type ReportMenuStub = { slug: string; label: string; reason: string };

export const REPORT_MENU_STUBS: ReportMenuStub[] = [
  {
    slug: "feedback",
    label: "Отчёт обратной связи (бот акт сверки)",
    reason:
      "В SALEC нет домена рейтингов/обратной связи бота акта сверки (SalesDoc /report/feedbackReport)."
  },
  {
    slug: "nr",
    label: "НР отчёты",
    reason: "В SalesDoc меню соответствующий отчёт не найден."
  },
  {
    slug: "tare",
    label: "По тарам",
    reason:
      "Нужен модуль тары (SalesDoc /clients/taradoc). В SALEC есть только справочник оборудования «Тара»."
  }
];

export const REPORT_STUB_FALLBACK_REASON =
  "Раздел пока недоступен. Функции появятся после появления домена.";

function findStub(slug: string): ReportMenuStub | undefined {
  return REPORT_MENU_STUBS.find((x) => x.slug === slug);
}

export function reportStubTitle(slug: string) {
  return findStub(slug)?.label ?? "Отчёт";
}

export function reportStubReason(slug: string) {
  return findStub(slug)?.reason ?? REPORT_STUB_FALLBACK_REASON;
}

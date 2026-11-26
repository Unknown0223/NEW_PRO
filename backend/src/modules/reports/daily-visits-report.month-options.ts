/** Oy id (1–12) saqlanadi; UI da faqat RU nom. */
export const MONTH_NAMES_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
] as const;

export const DAILY_VISITS_MONTH_OPTIONS = MONTH_NAMES_RU.map((label, i) => ({
  id: String(i + 1),
  label
}));

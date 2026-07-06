/** Backend `defaultMobileConfigForRole('agent').route` bilan mos. */
export const AGENT_ROUTE_DEFAULTS = {
  daily_visit_limit: 50,
  readd_cooldown_days: 0
} as const;

export const ROUTE_COOLDOWN_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "0 — har kuni marshrutda (pauza yo‘q)" },
  { value: 1, label: "1 kun — faqat xaritadan yashiriladi" },
  { value: 3, label: "3 kun — faqat xaritadan yashiriladi" },
  { value: 7, label: "7 kun — faqat xaritadan yashiriladi" },
  { value: 14, label: "14 kun — faqat xaritadan yashiriladi" }
];

export function effectiveRouteCooldownDays(raw: number | null | undefined): number {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return AGENT_ROUTE_DEFAULTS.readd_cooldown_days;
  return raw;
}

export function effectiveDailyVisitLimit(raw: number | null | undefined): number {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return AGENT_ROUTE_DEFAULTS.daily_visit_limit;
  return raw;
}

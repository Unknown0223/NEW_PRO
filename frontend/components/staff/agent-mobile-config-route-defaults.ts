/** Backend `defaultMobileConfigForRole('agent').route` bilan mos. */
export const AGENT_ROUTE_DEFAULTS = {
  daily_visit_limit: 50,
  readd_cooldown_days: 0
} as const;

export const ROUTE_COOLDOWN_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "0 — каждый день на маршруте (без паузы)" },
  { value: 1, label: "1 день — скрывать только с карты" },
  { value: 3, label: "3 дня — скрывать только с карты" },
  { value: 7, label: "7 дней — скрывать только с карты" },
  { value: 14, label: "14 дней — скрывать только с карты" }
];

export function effectiveRouteCooldownDays(raw: number | null | undefined): number {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return AGENT_ROUTE_DEFAULTS.readd_cooldown_days;
  return raw;
}

export function effectiveDailyVisitLimit(raw: number | null | undefined): number {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return AGENT_ROUTE_DEFAULTS.daily_visit_limit;
  return raw;
}

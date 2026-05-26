export type ReturnFilterSettingsLike = {
  period_enabled: boolean;
  period_unit: "day" | "month";
  period_value: number;
};

export function defaultPolkiDateRangeFromFilter(
  rf: ReturnFilterSettingsLike | undefined,
  today = new Date()
): { dateFrom: string; dateTo: string } | null {
  if (!rf?.period_enabled) return null;
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime());
  if (rf.period_unit === "month") {
    fromDate.setMonth(fromDate.getMonth() - rf.period_value);
  } else {
    fromDate.setDate(fromDate.getDate() - rf.period_value);
  }
  return { dateFrom: fromDate.toISOString().slice(0, 10), dateTo: to };
}

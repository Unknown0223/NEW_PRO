/** Cover kunida agent oylikdan chiqariladi; SVR qatoriga shu belgi. */
export const SVR_COVER_TAG = "SVR_COVER" as const;

export function shouldExcludeAgentDay(coverActiveForDay: boolean): boolean {
  return coverActiveForDay;
}

export function svrCoverTag(): typeof SVR_COVER_TAG {
  return SVR_COVER_TAG;
}

/** Agent kunlari ro‘yxatidan cover kunlarini olib tashlash. */
export function excludeCoveredAgentDays(
  days: string[],
  coveredDates: Set<string>
): string[] {
  return days.filter((d) => !coveredDates.has(d));
}

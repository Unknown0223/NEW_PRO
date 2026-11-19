import type { Period } from "./types";

export const MONTHS_UZ = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr"
];

export function periodKey(period: Period): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function previousPeriod(period: Period): Period {
  return period.month === 1
    ? { year: period.year - 1, month: 12 }
    : { year: period.year, month: period.month - 1 };
}

export function shiftPeriod(period: Period, delta: number): Period {
  const index = period.year * 12 + period.month - 1 + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export function periodLabel(period: Period): string {
  return `${MONTHS_UZ[period.month - 1]} ${period.year}`;
}

export function validPeriod(period: Period): boolean {
  return (
    Number.isInteger(period.year) &&
    period.year >= 2000 &&
    period.year <= 2100 &&
    Number.isInteger(period.month) &&
    period.month >= 1 &&
    period.month <= 12
  );
}

export function periodDistance(source: Period, target: Period): number {
  return (target.year - source.year) * 12 + target.month - source.month;
}

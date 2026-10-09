import { Prisma } from "@prisma/client";

export const LIMIT_ROUND_STEPS = [1, 1000, 10000, 100000, 1000000] as const;
export type LimitRound = (typeof LIMIT_ROUND_STEPS)[number];

/** Eski oy qiymati: limit qo‘yilmagan (cheksiz) yoki tarix yo‘q — taklif yo‘q. */
export function proposeLimitFromSnapshot(value: Prisma.Decimal | null): string | null {
  return value != null ? value.toString() : null;
}

/** Reja summasining `percent` foizi, `round` qadamiga yaxlitlangan; reja yo‘q yoki 0 — taklif yo‘q. */
export function proposeLimitFromPlan(planSum: Prisma.Decimal | null, percent: number, round: LimitRound): string | null {
  if (planSum == null || planSum.lte(0) || !(percent > 0)) return null;
  const raw = planSum.mul(percent).div(100);
  return raw.div(round).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).mul(round).toString();
}

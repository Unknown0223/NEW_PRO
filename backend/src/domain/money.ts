import { Prisma } from "@prisma/client";

/** Pul miqdori — Prisma.Decimal asosida, 2 xona aniqlik. */
export type Money = Prisma.Decimal;

export function moneyFrom(value: Prisma.Decimal | string | number): Money {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

export function roundMoney(d: Money): Money {
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneyToNumber(d: Money): number {
  return Number(d);
}

export function moneyToString(d: Money): string {
  return d.toString();
}

import { Prisma } from "@prisma/client";

export function parseYmdToDateStart(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function parseYmdToDateEnd(s: string): Date {
  return new Date(`${s}T23:59:59.999Z`);
}

export function daysInclusive(from: string, to: string): number {
  const a = parseYmdToDateStart(from).getTime();
  const b = parseYmdToDateStart(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.max(1, Math.floor((b - a) / 86_400_000) + 1);
}

export function toNum(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits);
}

export function riskFromCoverage(coverageDays: number): "low" | "medium" | "healthy" | "overstock" {
  if (coverageDays < 3) return "low";
  if (coverageDays > 60) return "overstock";
  if (coverageDays < 10) return "medium";
  return "healthy";
}

export function fixed(n: number, digits: number): string {
  return Number.isFinite(n) ? n.toFixed(digits) : Number(0).toFixed(digits);
}

export function ymdStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function ymdEnd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999Z`);
}

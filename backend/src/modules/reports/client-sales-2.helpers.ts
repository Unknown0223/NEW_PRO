import { Prisma } from "@prisma/client";

export function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function intList(v?: string): number[] {
  return (v ?? "")
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x) && x > 0);
}

export function strList(v?: string): string[] {
  return (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function numOr(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number.parseFloat(v.replaceAll(" ", ""));
  return Number.isFinite(n) ? n : undefined;
}


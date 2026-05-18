import { Prisma } from "@prisma/client";
import { ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";

export function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateEnd(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
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

export function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

export const KNOWN_ORDER_TYPES = [...ORDER_TYPES] as string[];

export function orderTypeLabelRu(id: string): string {
  const k = id as keyof typeof ORDER_TYPE_LABELS;
  return ORDER_TYPE_LABELS[k] ?? id;
}

/** Filtr ro‘yxati — operator UI (rus.) */
export const ORDER_STATUS_LABEL_RU: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  picking: "Комплектация",
  delivering: "Отгружен",
  delivered: "Доставлен",
  returned: "Возврат",
  cancelled: "Отменён"
};

export function parseOrderTypesParam(v?: string): string[] {
  const allow = new Set<string>(KNOWN_ORDER_TYPES);
  return strList(v).filter((x) => allow.has(x));
}

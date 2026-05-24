import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";

import type { OrderItemSummary } from "./returns-enhanced.types";

export function localDayStart(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date(iso);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function localDayEnd(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date(iso);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
}

export function R(v: string | number | Prisma.Decimal): Prisma.Decimal {
  const d = new Prisma.Decimal(v);
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Qaytarish qoldig‘i: fizik шт — butun son (0 → "0"). */
export function formatAdjustedQtyString(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const whole = Math.floor(n + 1e-9);
  return whole > 0 ? String(whole) : "0";
}

type ReturnLineQty = {
  product_id: number;
  qty: Prisma.Decimal | string | number;
  paid_qty?: Prisma.Decimal | string | number | null;
  bonus_qty?: Prisma.Decimal | string | number | null;
};

/** Qaytarish qatoridan pullik / bonus miqdorini ajratish (legacy: faqat `qty`). */
export function splitReturnLinePaidBonus(ln: ReturnLineQty): { paid: number; bonus: number } {
  const t = Number(ln.qty);
  if (!Number.isFinite(t) || t <= 0) return { paid: 0, bonus: 0 };
  const pRaw = ln.paid_qty != null ? Number(ln.paid_qty) : NaN;
  const bRaw = ln.bonus_qty != null ? Number(ln.bonus_qty) : NaN;
  if (Number.isFinite(pRaw) && Number.isFinite(bRaw)) {
    return { paid: Math.max(0, pRaw), bonus: Math.max(0, bRaw) };
  }
  if (Number.isFinite(pRaw)) {
    const paid = Math.max(0, pRaw);
    return { paid, bonus: Math.max(0, t - paid) };
  }
  if (Number.isFinite(bRaw)) {
    const bonus = Math.max(0, bRaw);
    return { paid: Math.max(0, t - bonus), bonus };
  }
  return { paid: t, bonus: 0 };
}

/**
 * Oldingi posted qaytarishlar: pullik va bonus qatorlari alohida «pool»da.
 * Aks holda bitta mahsulot bo‘yicha bonus qaytarilganda pullik qatorlari ham
 * noto‘g‘ri qisqaradi yoki qoldiq Math.round bilan 0 bo‘lib, jadval bo‘shab qoladi.
 */
export function adjustOrderItemsQtyAfterPriorReturns(
  items: OrderItemSummary[],
  returns: Array<{
    order_id: number | null;
    lines: ReturnLineQty[];
  }>
): OrderItemSummary[] {
  const alreadyPaid = new Map<string, number>();
  const alreadyBonus = new Map<string, number>();
  for (const ret of returns) {
    const oid = ret.order_id;
    if (oid == null || oid < 1) continue;
    for (const ln of ret.lines) {
      const k = `${oid}:${ln.product_id}`;
      const { paid, bonus } = splitReturnLinePaidBonus(ln);
      alreadyPaid.set(k, (alreadyPaid.get(k) ?? 0) + paid);
      alreadyBonus.set(k, (alreadyBonus.get(k) ?? 0) + bonus);
    }
  }

  /** Guruh: zakaz + mahsulot + bonus|pullik (order line turi) */
  const byPool = new Map<string, number[]>();
  items.forEach((it, idx) => {
    const pool = it.is_bonus ? "b" : "p";
    const k = `${it.order_id}:${it.product_id}:${pool}`;
    const arr = byPool.get(k) ?? [];
    arr.push(idx);
    byPool.set(k, arr);
  });

  const next = items.map((it) => ({ ...it }));
  for (const indices of byPool.values()) {
    if (indices.length === 0) continue;
    const i0 = indices[0]!;
    const oid = next[i0]!.order_id;
    const pid = next[i0]!.product_id;
    const isBonus = next[i0]!.is_bonus;
    const poolKey = `${oid}:${pid}`;
    const already = isBonus
      ? (alreadyBonus.get(poolKey) ?? 0)
      : (alreadyPaid.get(poolKey) ?? 0);

    let sumOrdered = 0;
    for (const i of indices) sumOrdered += Number(next[i]!.qty);

    const alreadyCapped = Math.min(already, sumOrdered);
    const remaining = Math.max(0, sumOrdered - alreadyCapped);

    if (remaining <= 0 || sumOrdered <= 0) {
      for (const i of indices) next[i] = { ...next[i]!, qty: "0" };
      continue;
    }

    let allocated = 0;
    for (let j = 0; j < indices.length; j++) {
      const i = indices[j]!;
      const q = Number(next[i]!.qty);
      if (j === indices.length - 1) {
        const last = Math.max(0, remaining - allocated);
        next[i] = { ...next[i]!, qty: formatAdjustedQtyString(last) };
      } else {
        const part = (remaining * q) / sumOrdered;
        const rounded = Math.floor(part + 1e-9);
        allocated += rounded;
        next[i] = { ...next[i]!, qty: formatAdjustedQtyString(rounded) };
      }
    }
  }

  return next.filter((it) => Number(it.qty) > 0);
}

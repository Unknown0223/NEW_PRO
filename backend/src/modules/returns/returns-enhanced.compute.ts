import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";

import type {
  CreatePeriodReturnBatchLine,
  CreatePeriodReturnLine,
  OrderItemSummary
} from "./returns-enhanced.types";
import { MAX_RETURN_ITEMS } from "./returns-enhanced.types";
import { R } from "./returns-enhanced.helpers";

export function computeReturnSplitFromOrderSnapshot(
  itemsAdjusted: OrderItemSummary[],
  returnedLines: { product_id: number; qty: number }[]
): {
  lines: Array<{ product_id: number; qty: number; paid_qty: number; bonus_qty: number; price: number }>;
  recalc: {
    original_bonus_qty: number;
    remaining_bonus_qty: number;
    excess_bonus: number;
    total_return_qty: number;
    paid_return_qty: number;
    bonus_return_qty: number;
    refund_amount: Prisma.Decimal;
  };
} {
  type Pool = { bonus: number; paid: number; paidValue: number };
  const pools = new Map<number, Pool>();

  for (const it of itemsAdjusted) {
    const q = Number(it.qty);
    if (!Number.isFinite(q) || q <= 0) continue;
    const pid = it.product_id;
    const row = pools.get(pid) ?? { bonus: 0, paid: 0, paidValue: 0 };
    if (it.is_bonus) {
      row.bonus += q;
    } else {
      const unit = Number(it.price);
      const p = Number.isFinite(unit) ? unit : 0;
      row.paid += q;
      row.paidValue += q * p;
    }
    pools.set(pid, row);
  }

  const originalBonusQty = [...pools.values()].reduce((a, x) => a + x.bonus, 0);

  const remBonus = new Map<number, number>();
  const remPaid = new Map<number, number>();
  const paidUnitPrice = new Map<number, number>();
  for (const [pid, pl] of pools) {
    remBonus.set(pid, pl.bonus);
    remPaid.set(pid, pl.paid);
    const avg = pl.paid > 0 ? pl.paidValue / pl.paid : 0;
    paidUnitPrice.set(pid, avg);
  }

  for (const it of itemsAdjusted) {
    const pid = it.product_id;
    if ((paidUnitPrice.get(pid) ?? 0) > 0) continue;
    const q = Number(it.qty);
    if (!Number.isFinite(q) || q <= 0) continue;
    if (!it.is_bonus) {
      const unit = Number(it.price);
      if (Number.isFinite(unit) && unit > 0) paidUnitPrice.set(pid, unit);
    }
  }

  let refund = new Prisma.Decimal(0);
  let bonusReturnQty = 0;
  let paidReturnQty = 0;

  const resultLines = returnedLines.map((rl) => {
    const pid = rl.product_id;
    const bAvail = remBonus.get(pid) ?? 0;
    const pAvail = remPaid.get(pid) ?? 0;
    const bQty = Math.min(rl.qty, bAvail);
    const pQty = rl.qty - bQty;
    remBonus.set(pid, bAvail - bQty);
    remPaid.set(pid, pAvail - pQty);
    const price = paidUnitPrice.get(pid) ?? 0;
    refund = refund.add(R(price).mul(pQty));
    bonusReturnQty += bQty;
    paidReturnQty += pQty;
    return { product_id: pid, qty: rl.qty, paid_qty: pQty, bonus_qty: bQty, price };
  });

  const totalRetQty = returnedLines.reduce((a, l) => a + l.qty, 0);

  return {
    lines: resultLines,
    recalc: {
      original_bonus_qty: originalBonusQty,
      remaining_bonus_qty: Math.max(0, originalBonusQty - bonusReturnQty),
      excess_bonus: bonusReturnQty,
      total_return_qty: totalRetQty,
      paid_return_qty: paidReturnQty,
      bonus_return_qty: bonusReturnQty,
      refund_amount: refund
    }
  };
}

// ─── Validate return qty doesn't exceed available ────────────────────────────

export function validateReturnQty(
  allItems: { product_id: number; qty: number }[],
  alreadyReturnedByProduct: Map<number, number>,
  lines: { product_id: number; qty: number }[]
): void {
  const orderedMap = new Map<number, number>();
  for (const it of allItems) {
    orderedMap.set(it.product_id, (orderedMap.get(it.product_id) ?? 0) + it.qty);
  }

  for (const ln of lines) {
    const ordered = orderedMap.get(ln.product_id) ?? 0;
    const alreadyRet = alreadyReturnedByProduct.get(ln.product_id) ?? 0;
    const available = ordered - alreadyRet;
    if (ln.qty > available) {
      throw new Error("RETURN_QTY_EXCEEDS_ORDERED");
    }
  }

  const totalQty = lines.reduce((a, l) => a + l.qty, 0);
  if (totalQty > MAX_RETURN_ITEMS) {
    throw new Error("TOO_MANY_ITEMS");
  }
}

/** Pul qaytarishni `maxRefund` bilan cheklaganda qatorlardagi paid/bonus taqsimotini saqlab qolish. */
export function scaleReturnLinesToMaxRefund(
  lines: Array<{ product_id: number; qty: number; paid_qty: number; bonus_qty: number; price: number }>,
  maxRefund: Prisma.Decimal
): {
  lines: Array<{ product_id: number; qty: number; paid_qty: number; bonus_qty: number; price: number }>;
  refund: Prisma.Decimal;
} {
  let refund = lines.reduce(
    (a, l) => a.add(R(l.price).mul(l.paid_qty)),
    new Prisma.Decimal(0)
  );
  if (!refund.gt(maxRefund)) {
    return { lines, refund };
  }
  /** `maxRefund.div(0)` → ∞ / NaN → Prisma xato yoki 500 */
  if (!refund.gt(0)) {
    return { lines, refund: new Prisma.Decimal(0) };
  }
  const ratio = maxRefund.div(refund);
  const adjusted = lines.map((l) => {
    const oldPaid = new Prisma.Decimal(l.paid_qty);
    const newPaid = R(oldPaid.mul(ratio));
    const shift = oldPaid.sub(newPaid);
    const newBonus = R(new Prisma.Decimal(l.bonus_qty).add(shift));
    return {
      product_id: l.product_id,
      qty: l.qty,
      paid_qty: Number(newPaid.toString()),
      bonus_qty: Number(newBonus.toString()),
      price: l.price
    };
  });
  refund = adjusted.reduce(
    (a, l) => a.add(R(l.price).mul(l.paid_qty)),
    new Prisma.Decimal(0)
  );
  if (refund.gt(maxRefund)) {
    refund = maxRefund;
  }
  return { lines: adjusted, refund };
}

/** Po zakaz: pullikni bonusga aylantirmasdan; davr rejimida `scaleReturnLinesToMaxRefund`. */
export function finalizePolkiReturnLines(
  lines: Array<{ product_id: number; qty: number; paid_qty: number; bonus_qty: number; price: number }>,
  maxRefund: Prisma.Decimal,
  opts: { orderScoped: boolean }
): {
  lines: Array<{ product_id: number; qty: number; paid_qty: number; bonus_qty: number; price: number }>;
  refund: Prisma.Decimal;
} {
  const refund = lines.reduce(
    (a, l) => a.add(R(l.price).mul(l.paid_qty)),
    new Prisma.Decimal(0)
  );
  if (opts.orderScoped) {
    if (refund.gt(maxRefund)) throw new Error("REFUND_EXCEEDS_ORDER_REMAINING");
    return { lines, refund };
  }
  return scaleReturnLinesToMaxRefund(lines, maxRefund);
}

export function physicalQtyFromPeriodLine(l: CreatePeriodReturnLine | CreatePeriodReturnBatchLine): number {
  if (l.qty != null && l.qty > 0) return l.qty;
  return (l.paid_qty ?? 0) + (l.bonus_qty ?? 0);
}

/** Erkin polki: paid/bonus explicit — hujjat bo‘yicha 24 dona limiti qo‘llanmaydi (faqat qator «макс»). */
export function periodReturnUsesExplicitLines(
  lines: Array<{
    qty?: number;
    return_qty?: number;
    paid_qty?: number;
    bonus_qty?: number;
    bonus_cash?: number;
  }>
): boolean {
  if (lines.length === 0) return false;
  const noLegacyQty = lines.every((l) => !(l.qty != null && l.qty > 0));
  if (!noLegacyQty) return false;
  if (lines.some((l) => (l.return_qty ?? 0) > 0)) return true;
  return lines.some(
    (l) => (l.paid_qty ?? 0) > 0 || (l.bonus_qty ?? 0) > 0 || (l.bonus_cash ?? 0) > 0
  );
}

export function assertPeriodLineModes(lines: CreatePeriodReturnLine[]): void {
  let legacy = 0;
  let explicit = 0;
  for (const l of lines) {
    const isLeg = l.qty != null && l.qty > 0;
    const isExp =
      (l.paid_qty ?? 0) > 0 ||
      (l.bonus_qty ?? 0) > 0 ||
      (l.bonus_cash ?? 0) > 0;
    if (isLeg && isExp) throw new Error("MIXED_LINE_FIELDS");
    if (!isLeg && !isExp) throw new Error("EMPTY_LINE");
    if (isLeg) legacy++;
    else explicit++;
  }
  if (legacy > 0 && explicit > 0) throw new Error("MIXED_LINE_MODES");
}

export function assertBatchLineModes(lines: CreatePeriodReturnBatchLine[]): void {
  let legacy = 0;
  let explicit = 0;
  for (const l of lines) {
    const isLeg = l.qty != null && l.qty > 0;
    const isExp =
      (l.paid_qty ?? 0) > 0 ||
      (l.bonus_qty ?? 0) > 0 ||
      (l.bonus_cash ?? 0) > 0;
    if (isLeg && isExp) throw new Error("MIXED_LINE_FIELDS");
    if (!isLeg && !isExp) throw new Error("EMPTY_LINE");
    if (isLeg) legacy++;
    else explicit++;
  }
  if (legacy > 0 && explicit > 0) throw new Error("MIXED_LINE_MODES");
}

export function priceByProductFromItems(allItems: { product_id: number; price: string; is_bonus?: boolean }[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const it of allItems) {
    const p = Number(it.price);
    if (!Number.isFinite(p) || p < 0) continue;
    if (it.is_bonus) {
      if (!m.has(it.product_id)) m.set(it.product_id, p);
      continue;
    }
    m.set(it.product_id, p);
  }
  return m;
}

export function buildPaidBonusAvailability(
  allItems: { product_id: number; qty: string; is_bonus: boolean }[]
): { paid: Map<number, number>; bonus: Map<number, number> } {
  const paid = new Map<number, number>();
  const bonus = new Map<number, number>();
  for (const it of allItems) {
    const q = Number(it.qty);
    if (!(q > 0)) continue;
    const t = it.is_bonus ? bonus : paid;
    t.set(it.product_id, (t.get(it.product_id) ?? 0) + q);
  }
  return { paid, bonus };
}

/** Erkin/po-zakaz polki: `return_qty` zakaz qoldig‘idan oshmasin. */
export function validateExplicitReturnQtyAgainstItems(
  allItems: { product_id: number; qty: string; is_bonus: boolean }[],
  lines: { product_id: number; return_qty?: number }[]
): void {
  const avail = new Map<number, number>();
  for (const it of allItems) {
    const q = Number(it.qty);
    if (!(q > 0)) continue;
    avail.set(it.product_id, (avail.get(it.product_id) ?? 0) + q);
  }
  const sumReturnQty = new Map<number, number>();
  for (const ln of lines) {
    const rq = ln.return_qty;
    if (rq == null || !(rq > 0)) continue;
    sumReturnQty.set(ln.product_id, (sumReturnQty.get(ln.product_id) ?? 0) + rq);
  }
  for (const [pid, rq] of sumReturnQty) {
    if (rq > (avail.get(pid) ?? 0) + 1e-9) {
      throw new Error("RETURN_QTY_EXCEEDS_ORDERED");
    }
  }
}

export function validateExplicitReturnAgainstItems(
  allItems: { product_id: number; qty: string; is_bonus: boolean }[],
  lines: { product_id: number; paid_qty: number; bonus_qty: number; bonus_cash: number }[],
  priceByProduct: Map<number, number>
): void {
  const { paid: paidAvail, bonus: bonusAvail } = buildPaidBonusAvailability(allItems);
  const sumPaid = new Map<number, number>();
  const sumBonus = new Map<number, number>();
  const sumCash = new Map<number, number>();
  for (const ln of lines) {
    sumPaid.set(ln.product_id, (sumPaid.get(ln.product_id) ?? 0) + ln.paid_qty);
    sumBonus.set(ln.product_id, (sumBonus.get(ln.product_id) ?? 0) + ln.bonus_qty);
    if (ln.bonus_cash > 0) {
      sumCash.set(ln.product_id, (sumCash.get(ln.product_id) ?? 0) + ln.bonus_cash);
    }
  }
  for (const [pid, sp] of sumPaid) {
    if (sp > (paidAvail.get(pid) ?? 0)) throw new Error("RETURN_QTY_EXCEEDS_ORDERED");
  }
  for (const [pid, sb] of sumBonus) {
    if (sb > (bonusAvail.get(pid) ?? 0)) throw new Error("RETURN_QTY_EXCEEDS_ORDERED");
  }
  for (const [pid, cash] of sumCash) {
    if (!(cash > 0)) continue;
    const bonusLeft = (bonusAvail.get(pid) ?? 0) - (sumBonus.get(pid) ?? 0);
    const price = priceByProduct.get(pid) ?? 0;
    const maxCash = R(bonusLeft * price);
    if (R(cash).gt(maxCash)) throw new Error("BONUS_CASH_EXCEEDS");
  }
}

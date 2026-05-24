import { computeQtyBonusForRuleRow } from "../bonus-rules/bonus-rules.service";
import type { BonusRuleRow } from "../bonus-rules/bonus-rules.types";
import type { ProductReturnPool } from "./returns-bonus-reverse.pools";

export type OrderLevelBonusInput = {
  remainingPaidBefore: number;
  remainingBonusBefore: number;
  paidReturnThisTime: number;
  rule: BonusRuleRow | null;
};

/** Qolgan pullik bo‘yicha bonus haqqi → qaytariladigan bonus (42→30→15→0 misoli). */
export function computeOrderLevelBonusToReturn(input: OrderLevelBonusInput): {
  remainingPaidAfter: number;
  bonusEntitledAfter: number;
  bonusToReturn: number;
} {
  const remPaidBefore = Math.max(0, input.remainingPaidBefore);
  const remBonusBefore = Math.max(0, input.remainingBonusBefore);
  const paidReturn = Math.max(0, Math.min(input.paidReturnThisTime, remPaidBefore));
  const remainingPaidAfter = Math.max(0, remPaidBefore - paidReturn);
  const bonusEntitledAfter =
    input.rule != null ? Math.max(0, computeQtyBonusForRuleRow(input.rule, remainingPaidAfter)) : 0;
  const bonusToReturn = Math.max(0, remBonusBefore - bonusEntitledAfter);
  return { remainingPaidAfter, bonusEntitledAfter, bonusToReturn };
}

/** Zakaz darajasidagi bonus qaytarishni bonus-pool bor mahsulotlarga taqsimlash. */
export function distributeOrderBonusReturn(
  bonusToReturnTotal: number,
  pools: Map<number, ProductReturnPool>,
  bonusProductIds: Set<number>
): Map<number, number> {
  const out = new Map<number, number>();
  if (!(bonusToReturnTotal > 0)) return out;

  const candidates: Array<{ productId: number; cap: number }> = [];
  for (const pid of bonusProductIds) {
    const pool = pools.get(pid);
    if (!pool || pool.max_bonus <= 0) continue;
    candidates.push({ productId: pid, cap: pool.max_bonus });
  }
  if (candidates.length === 0) {
    for (const [pid, pool] of pools) {
      if (pool.max_bonus > 0) candidates.push({ productId: pid, cap: pool.max_bonus });
    }
  }
  candidates.sort((a, b) => b.cap - a.cap);

  let left = bonusToReturnTotal;
  for (const c of candidates) {
    if (left <= 0) break;
    const take = Math.min(left, c.cap);
    if (take > 0) {
      out.set(c.productId, (out.get(c.productId) ?? 0) + take);
      left -= take;
    }
  }
  return out;
}

/** `return_qty` dan pullik qismi (qoldiq pullikdan oshmasin). */
export function paidReturnFromLineQty(returnQty: number, pool: ProductReturnPool): number {
  const rq = Math.max(0, returnQty);
  const cap = Math.max(0, pool.max_paid);
  return Math.min(rq, cap);
}

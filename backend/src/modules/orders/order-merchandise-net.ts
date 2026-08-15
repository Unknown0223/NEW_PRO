import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export type OrderMerchandiseRuleHint = {
  type: string;
  discount_pct: number | null;
};

/** Qoida mahsulot narxini / total_sum ni net qiladimi (foizli skidka). */
export function ruleAppliesMerchandiseDiscount(r: OrderMerchandiseRuleHint | undefined): boolean {
  if (!r) return false;
  if (r.type === "discount") return true;
  if (r.type === "sum" && r.discount_pct != null && r.discount_pct > 0) return true;
  return false;
}

/**
 * Zakaz bo'yicha to'lanadigan mahsulot summasi (bonus qatorlari alohida).
 *
 * Schema kontrakti (create/update):
 * - `total_sum` — chegirmadan keyin (net, to‘lanadigan)
 * - `discount_sum` — chegirma miqdori (gross − net)
 *
 * `type=discount` va `type=sum`+`discount_pct` ikkalasi ham qatorlarni kamaytiradi
 * va `paidTotal` ni `total_sum` ga yozadi. Shuning uchun qarz/to‘lovda
 * `discount_sum` ni qayta ayirish mumkin emas (ikki marta skidka).
 *
 * `appliedRuleIds` / `rulesById` — imzo mosligi uchun saqlangan (chaqiruvchilar).
 */
export function orderMerchandiseNetReceivable(
  totalSum: Prisma.Decimal,
  _discountSum: Prisma.Decimal,
  _appliedRuleIds: readonly number[] = [],
  _rulesById: ReadonlyMap<number, OrderMerchandiseRuleHint> = new Map()
): Prisma.Decimal {
  return totalSum;
}

export type ApplyOrderLevelDiscountPctOpts = {
  /**
   * `orders.total_sum` — chegirmadan keyin (net).
   * Foiz = disc / (net + disc) when `linesAlreadyNet`.
   */
  totalSum?: Prisma.Decimal;
  /** Qator narxlari allaqachon net (create path). */
  linesAlreadyNet?: boolean;
};

/** Zakaz darajasidagi skidka: qatorlarda `discount_pct` ko‘rinishi (faqat display). */
export function applyOrderLevelDiscountPctToItems(
  items: Array<{ is_bonus: boolean; total: string; discount_pct?: string | null }>,
  discountSum: Prisma.Decimal,
  opts?: ApplyOrderLevelDiscountPctOpts
): Array<{ is_bonus: boolean; total: string; discount_pct?: string | null }> {
  if (discountSum.lte(0)) return items;
  const paid = items.filter((i) => !i.is_bonus);
  const linesSum = paid.reduce((a, i) => a.add(new Prisma.Decimal(i.total)), new Prisma.Decimal(0));
  if (linesSum.lte(0) && (opts?.totalSum == null || opts.totalSum.lte(0))) return items;

  // totalSum berilgan bo‘lsa — schema bo‘yicha net; foiz = disc/(net+disc).
  const linesAlreadyNet = opts?.linesAlreadyNet === true || opts?.totalSum != null;

  const gross =
    linesAlreadyNet && opts?.totalSum != null
      ? opts.totalSum.add(discountSum)
      : linesSum.gt(0)
        ? linesSum
        : (opts?.totalSum?.add(discountSum) ?? discountSum);
  if (gross.lte(0)) return items;

  const pct = discountSum
    .div(gross)
    .mul(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toFixed(0);
  return items.map((i) => {
    if (i.is_bonus) return i;
    const existing = i.discount_pct?.trim();
    if (existing && existing !== "0" && existing !== "0.00") return i;
    return { ...i, discount_pct: pct };
  });
}

/** Applied qoidalar ichida foizli skidka (discount yoki sum+discount_pct) bormi. */
export async function orderHasAppliedDiscountRule(
  tenantId: number,
  appliedRuleIds: readonly number[]
): Promise<boolean> {
  const ids = appliedRuleIds.filter((id) => id > 0);
  if (ids.length === 0) return false;
  const hit = await prisma.bonusRule.findFirst({
    where: {
      tenant_id: tenantId,
      id: { in: [...ids] },
      OR: [{ type: "discount" }, { type: "sum", discount_pct: { gt: 0 } }]
    },
    select: { id: true }
  });
  return hit != null;
}

export function orderUnpaidMerchandise(
  totalSum: Prisma.Decimal,
  discountSum: Prisma.Decimal,
  allocated: Prisma.Decimal,
  appliedRuleIds: readonly number[],
  rulesById: ReadonlyMap<number, OrderMerchandiseRuleHint>
): Prisma.Decimal {
  const base = orderMerchandiseNetReceivable(totalSum, discountSum, appliedRuleIds, rulesById);
  const unpaid = base.sub(allocated);
  return unpaid.gt(0) ? unpaid : new Prisma.Decimal(0);
}

/** SQL: `orders` jadvali aliasi bo'yicha to'lanadigan mahsulot summasi (= total_sum, net). */
export function sqlOrderMerchandiseNetReceivable(orderAlias = "o"): Prisma.Sql {
  const o = Prisma.raw(orderAlias);
  return Prisma.sql`${o}.total_sum::decimal(15,2)`;
}

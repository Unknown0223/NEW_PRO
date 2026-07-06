import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export type OrderMerchandiseRuleHint = {
  type: string;
  discount_pct: number | null;
};

/**
 * Zakaz bo'yicha to'lanadigan mahsulot summasi (bonus qatorlari alohida).
 *
 * Schema: `total_sum` — chegirmadan keyin; `discount_sum` — chegirma miqdori.
 * `type=discount` qoidasi qo'llanganda qator narxlari kamayadi va `total_sum` net.
 *
 * `type=sum` + `discount_pct` ba'zi yozuvlarda faqat `discount_sum` ni to'ldiradi,
 * qatorlar esa to'liq narxda qoladi — bunda net = `total_sum - discount_sum`.
 */
export function orderMerchandiseNetReceivable(
  totalSum: Prisma.Decimal,
  discountSum: Prisma.Decimal,
  appliedRuleIds: readonly number[],
  rulesById: ReadonlyMap<number, OrderMerchandiseRuleHint>
): Prisma.Decimal {
  if (discountSum.lte(0)) return totalSum;

  const hasAppliedDiscountRule = appliedRuleIds.some((id) => rulesById.get(id)?.type === "discount");
  if (hasAppliedDiscountRule) return totalSum;

  // Skidka `discount_sum` da, lekin `type=discount` qoidasi qo'llanmagan
  // (masalan, sum-qoida + discount_pct yoki eski/noto'g'ri yozuvlar).
  return Prisma.Decimal.max(totalSum.sub(discountSum), new Prisma.Decimal(0));
}

/** Zakaz darajasidagi skidka: qatorlarda `discount_pct` ko‘rinishi (faqat display). */
export function applyOrderLevelDiscountPctToItems(
  items: Array<{ is_bonus: boolean; total: string; discount_pct?: string | null }>,
  discountSum: Prisma.Decimal
): Array<{ is_bonus: boolean; total: string; discount_pct?: string | null }> {
  if (discountSum.lte(0)) return items;
  const paid = items.filter((i) => !i.is_bonus);
  const gross = paid.reduce((a, i) => a.add(new Prisma.Decimal(i.total)), new Prisma.Decimal(0));
  if (gross.lte(0)) return items;
  const pct = discountSum.div(gross).mul(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toString();
  return items.map((i) => {
    if (i.is_bonus) return i;
    const existing = i.discount_pct?.trim();
    if (existing && existing !== "0" && existing !== "0.00") return i;
    return { ...i, discount_pct: pct };
  });
}

export async function orderHasAppliedDiscountRule(
  tenantId: number,
  appliedRuleIds: readonly number[]
): Promise<boolean> {
  const ids = appliedRuleIds.filter((id) => id > 0);
  if (ids.length === 0) return false;
  const hit = await prisma.bonusRule.findFirst({
    where: { tenant_id: tenantId, id: { in: [...ids] }, type: "discount" },
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

/** SQL: `orders` jadvali aliasi bo'yicha to'lanadigan mahsulot summasi. */
export function sqlOrderMerchandiseNetReceivable(orderAlias = "o"): Prisma.Sql {
  const o = Prisma.raw(orderAlias);
  return Prisma.sql`
    GREATEST(
      CASE
        WHEN ${o}.discount_sum > 0 AND NOT EXISTS (
          SELECT 1
          FROM bonus_rules br
          WHERE br.tenant_id = ${o}.tenant_id
            AND br.id = ANY(${o}.applied_auto_bonus_rule_ids)
            AND br.type = 'discount'
        ) THEN (${o}.total_sum - ${o}.discount_sum)
        ELSE ${o}.total_sum
      END,
      0::decimal(15,2)
    )::decimal(15,2)
  `;
}

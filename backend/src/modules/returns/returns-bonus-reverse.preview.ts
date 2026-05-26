import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  computeQtyBonusForRuleRow,
  computeReturnQtyBonusForRuleRow
} from "../bonus-rules/bonus-rules.service";
import { getClientReturnsData } from "./returns-enhanced.client-data";
import { buildProductReturnPools } from "./returns-bonus-reverse.pools";
import { effectiveReturnPriceType } from "./returns-enhanced.types";
import {
  findQtyRuleForProduct,
  loadActiveQtyBonusRules,
  ruleQtyLabel
} from "./returns-bonus-reverse.match";
import {
  computeOrderLevelBonusToReturn,
  distributeOrderBonusReturn,
  paidReturnFromLineQty
} from "./returns-bonus-reverse.order-level";
import type { ProductLite } from "../orders/order-bonus-context.fetch";
import {
  loadInterchangeableSiblingsByProductId,
  resolveAutoPeresortWarehouse,
  type PolkiAllocationMode
} from "./returns-bonus-reverse.peresort";

export type PolkiAutoBonusPreviewLineInput = {
  product_id: number;
  return_qty: number;
};

export type PolkiAutoBonusPreviewLine = {
  product_id: number;
  sku: string;
  name: string;
  return_qty: number;
  paid_qty: number;
  bonus_qty: number;
  bonus_cash: number;
  rule_id: number | null;
  rule_name: string | null;
  rule_label: string | null;
  bonus_debt_qty: number;
  bonus_debt_amount: number;
  max_paid: number;
  max_bonus: number;
  bonus_warehouse_product_id: number;
  bonus_warehouse_product_name: string;
  allocation_mode: PolkiAllocationMode;
  peresort_debt_amount: number;
};

export type PolkiAutoBonusPreviewResult = {
  lines: PolkiAutoBonusPreviewLine[];
  totals: {
    paid_qty: number;
    bonus_qty: number;
    bonus_debt_qty: number;
    bonus_debt_amount: string;
    refund_amount: string;
  };
  warnings: string[];
};

export type PolkiAutoBonusPreviewInput = {
  client_id: number;
  /** Polki po zakaz: faqat shu zakaz pozitsiyalari va narxlari. */
  order_id?: number | null;
  date_from?: string;
  date_to?: string;
  price_type?: string | null;
  category_ids?: number[];
  lines: PolkiAutoBonusPreviewLineInput[];
  reference_at?: Date;
};

function roundMoney(d: Prisma.Decimal): string {
  return d.toDecimalPlaces(2).toString();
}

/** Po zakaz: bonus faqat snapshot (`max_bonus`) bo‘lgan mahsulotda; qoidadan ortiqcha — долг emas. */
export function resolveReturnBonusTheoretical(input: {
  scopedToOrder: boolean;
  returnQty: number;
  pool: { max_paid: number; max_bonus: number };
  ruleBonusFromQty: number | null;
}): number {
  const { returnQty, pool } = input;
  const maxBonus = Math.max(0, pool.max_bonus);
  if (input.scopedToOrder) {
    if (maxBonus <= 0) return 0;
    if (input.ruleBonusFromQty != null) {
      return Math.min(Math.max(0, input.ruleBonusFromQty), maxBonus);
    }
    return Math.min(Math.max(0, returnQty - pool.max_paid), maxBonus);
  }
  if (input.ruleBonusFromQty != null) {
    return Math.max(0, input.ruleBonusFromQty);
  }
  return Math.min(Math.max(0, returnQty - pool.max_paid), maxBonus);
}

export function computeReverseLineSplit(input: {
  return_qty: number;
  max_paid: number;
  max_bonus: number;
  unit_price_paid: number;
  unit_price_bonus: number;
  rule: { id: number; name: string; label: string } | null;
  bonus_reverseTheoretical: number;
}): Omit<
  PolkiAutoBonusPreviewLine,
  "product_id" | "sku" | "name" | "max_paid" | "max_bonus"
> {
  const rq = Math.max(0, input.return_qty);
  const maxPaid = Math.max(0, input.max_paid);
  const maxBonus = Math.max(0, input.max_bonus);
  const capTotal = maxPaid + maxBonus;
  const effectiveReturn = Math.min(rq, capTotal);

  const bonusTheoretical = Math.max(0, input.bonus_reverseTheoretical);
  const bonusApplied = Math.min(bonusTheoretical, maxBonus, effectiveReturn);
  const paidApplied = Math.min(Math.max(0, effectiveReturn - bonusApplied), maxPaid);

  const unallocated = Math.max(0, rq - bonusApplied - paidApplied);
  const bonusShortfall = Math.max(0, bonusTheoretical - bonusApplied);
  const debtQty = bonusShortfall + unallocated;
  const unitBonus = input.unit_price_bonus > 0 ? input.unit_price_bonus : input.unit_price_paid;
  const debtAmount = debtQty * unitBonus;

  return {
    return_qty: rq,
    paid_qty: paidApplied,
    bonus_qty: bonusApplied,
    bonus_cash: 0,
    rule_id: input.rule?.id ?? null,
    rule_name: input.rule?.name ?? null,
    rule_label: input.rule?.label ?? null,
    bonus_debt_qty: debtQty,
    bonus_debt_amount: debtAmount
  };
}

export async function previewPolkiAutoBonusReverse(
  tenantId: number,
  input: PolkiAutoBonusPreviewInput
): Promise<PolkiAutoBonusPreviewResult> {
  const warnings: string[] = [];
  const refAt = input.reference_at ?? new Date();
  const priceType = effectiveReturnPriceType(input.price_type);

  const orderId =
    input.order_id != null && Number.isFinite(input.order_id) && input.order_id > 0
      ? input.order_id
      : null;
  const cdata = await getClientReturnsData(
    tenantId,
    input.client_id,
    orderId == null ? input.date_from : undefined,
    orderId == null ? input.date_to : undefined,
    orderId,
    undefined,
    { shrinkLineQtyAfterReturns: true }
  );

  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { id: true, sku: true, name: true, unit: true, category_id: true, volume_m3: true }
  });
  const pmap = new Map(products.map((p) => [p.id, p]));

  const poolByProduct = buildProductReturnPools(cdata.items);

  const categorySet =
    input.category_ids && input.category_ids.length > 0
      ? new Set(input.category_ids)
      : null;

  const qtyRules = await loadActiveQtyBonusRules(tenantId, refAt);
  const siblingsByProduct = await loadInterchangeableSiblingsByProductId(tenantId);

  const bonusProductIds = new Set<number>();
  for (const it of cdata.items) {
    if (it.is_bonus) bonusProductIds.add(it.product_id);
  }

  const orderScoped = orderId != null;
  let orderRemainingPaid = 0;
  let orderRemainingBonus = 0;
  if (orderScoped) {
    for (const pool of poolByProduct.values()) {
      orderRemainingPaid += pool.max_paid;
      orderRemainingBonus += pool.max_bonus;
    }
  }

  type LineDraft = {
    ln: PolkiAutoBonusPreviewLineInput;
    p: NonNullable<ReturnType<typeof pmap.get>>;
    pool: NonNullable<ReturnType<typeof poolByProduct.get>>;
    returnQty: number;
    paidReturn: number;
    rule: ReturnType<typeof findQtyRuleForProduct>;
    ruleMeta: { id: number; name: string; label: string } | null;
  };
  const drafts: LineDraft[] = [];

  for (const ln of input.lines) {
    if (!(ln.return_qty > 0)) continue;
    const requestedQty = ln.return_qty;
    const p = pmap.get(ln.product_id);
    if (!p) {
      warnings.push(`Mahsulot #${ln.product_id} topilmadi`);
      continue;
    }
    if (categorySet && (p.category_id == null || !categorySet.has(p.category_id))) {
      continue;
    }

    const pool = poolByProduct.get(ln.product_id);
    if (!pool || pool.max_paid + pool.max_bonus <= 0) {
      warnings.push(`${p.name}: qaytarish uchun pozitsiya yo‘q`);
      continue;
    }

    const poolCap = pool.max_paid + pool.max_bonus;
    const returnQty = Math.min(requestedQty, poolCap);
    if (requestedQty > poolCap + 1e-9) {
      warnings.push(
        `${p.name}: не больше ${poolCap} шт по заказу (запрошено ${requestedQty})`
      );
    }

    const lite: ProductLite = {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category_id: p.category_id
    };
    const rule = findQtyRuleForProduct(qtyRules, lite);
    const ruleMeta = rule ? { id: rule.id, name: rule.name, label: ruleQtyLabel(rule) } : null;

    const paidReturn = orderScoped
      ? paidReturnFromLineQty(returnQty, pool)
      : Math.min(returnQty, pool.max_paid);

    drafts.push({ ln, p, pool, returnQty, paidReturn, rule, ruleMeta });
  }

  let orderBonusByProduct = new Map<number, number>();
  if (orderScoped && drafts.length > 0) {
    const paidReturnTotal = drafts.reduce((a, d) => a + d.paidReturn, 0);
    if (paidReturnTotal > orderRemainingPaid + 1e-9) {
      warnings.push(
        `По заказу осталось только ${orderRemainingPaid} шт оплаты — нельзя вернуть ${paidReturnTotal} шт.`
      );
    }
    let orderRule = drafts.find((d) => d.rule && d.pool.max_bonus > 0)?.rule ?? null;
    if (!orderRule) {
      orderRule = drafts.find((d) => d.rule)?.rule ?? null;
    }
    const { bonusToReturn } = computeOrderLevelBonusToReturn({
      remainingPaidBefore: orderRemainingPaid,
      remainingBonusBefore: orderRemainingBonus,
      paidReturnThisTime: paidReturnTotal,
      rule: orderRule
    });
    orderBonusByProduct = distributeOrderBonusReturn(bonusToReturn, poolByProduct, bonusProductIds);
  }

  const outLines: PolkiAutoBonusPreviewLine[] = [];
  let sumPaid = 0;
  let sumBonus = 0;
  let sumDebtQty = 0;
  let refund = new Prisma.Decimal(0);
  let sumDebtAmount = new Prisma.Decimal(0);

  for (const d of drafts) {
    const { p, pool, returnQty, paidReturn, ruleMeta } = d;
    let bonusTheoretical = 0;
    if (orderScoped) {
      bonusTheoretical = orderBonusByProduct.get(d.ln.product_id) ?? 0;
      bonusTheoretical = Math.min(bonusTheoretical, pool.max_bonus, returnQty);
    } else {
      const ruleBonus =
        d.rule != null ? computeReturnQtyBonusForRuleRow(d.rule, returnQty) : null;
      bonusTheoretical = resolveReturnBonusTheoretical({
        scopedToOrder: false,
        returnQty,
        pool,
        ruleBonusFromQty: ruleBonus
      });
      if (returnQty > 0 && !d.rule) {
        warnings.push(`${p.name}: mos qty-bonus qoidasi yo‘q — snapshot bo‘yicha taqsimlash`);
      }
    }

    const split = computeReverseLineSplit({
      return_qty: returnQty,
      max_paid: pool.max_paid,
      max_bonus: pool.max_bonus,
      unit_price_paid: pool.unit_price_paid,
      unit_price_bonus: pool.unit_price_bonus,
      rule: ruleMeta,
      bonus_reverseTheoretical: bonusTheoretical
    });

    if (orderScoped && paidReturn !== split.paid_qty) {
      split.paid_qty = paidReturn;
      split.bonus_qty = Math.min(
        bonusTheoretical,
        pool.max_bonus,
        Math.max(0, returnQty - paidReturn)
      );
      const unallocated = Math.max(0, returnQty - split.paid_qty - split.bonus_qty);
      const bonusShortfall = Math.max(0, bonusTheoretical - split.bonus_qty);
      split.bonus_debt_qty = bonusShortfall + unallocated;
      const unitBonus = pool.unit_price_bonus > 0 ? pool.unit_price_bonus : pool.unit_price_paid;
      split.bonus_debt_amount = split.bonus_debt_qty * unitBonus;
    }

    const peresort = resolveAutoPeresortWarehouse({
      sourceProductId: d.ln.product_id,
      sourceName: p.name,
      bonusQty: split.bonus_qty,
      paidQty: split.paid_qty,
      poolByProduct,
      siblings: siblingsByProduct.get(d.ln.product_id),
      unitPriceBonus: pool.unit_price_bonus
    });
    const lineDebtAmount = split.bonus_debt_amount + peresort.peresort_debt_amount;

    sumPaid += split.paid_qty;
    sumBonus += split.bonus_qty;
    sumDebtQty += split.bonus_debt_qty;
    refund = refund.add(new Prisma.Decimal(pool.unit_price_paid).mul(split.paid_qty));
    sumDebtAmount = sumDebtAmount.add(new Prisma.Decimal(lineDebtAmount));

    outLines.push({
      product_id: d.ln.product_id,
      sku: p.sku,
      name: p.name,
      max_paid: pool.max_paid,
      max_bonus: pool.max_bonus,
      ...split,
      bonus_debt_amount: lineDebtAmount,
      bonus_warehouse_product_id: peresort.bonus_warehouse_product_id,
      bonus_warehouse_product_name: peresort.bonus_warehouse_product_name,
      allocation_mode: peresort.allocation_mode,
      peresort_debt_amount: peresort.peresort_debt_amount
    });
  }

  return {
    lines: outLines,
    totals: {
      paid_qty: sumPaid,
      bonus_qty: sumBonus,
      bonus_debt_qty: sumDebtQty,
      bonus_debt_amount: roundMoney(sumDebtAmount),
      refund_amount: roundMoney(refund)
    },
    warnings
  };
}

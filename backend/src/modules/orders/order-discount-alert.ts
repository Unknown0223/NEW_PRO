import { Prisma } from "@prisma/client";
import {
  fetchClientUsedAutoBonusRuleIds,
  findWinningDiscountRuleWithPrereqs,
  loadDiscountRulesForOrder,
  loadAvailableQtyByProductId
} from "./order-bonus-apply";
import type { CreateOrderPaidBundle } from "./domain/order.create-tx.bonus";
import type { CreateOrderTxParams } from "./domain/order.create-tx.types";

export const DISCOUNT_ALERT_CODES = ["not_applied", "cash_desk_missing", "bonus_required"] as const;
export type DiscountAlertCode = (typeof DISCOUNT_ALERT_CODES)[number];

export type DiscountAlertResolution = {
  alert: DiscountAlertCode | null;
  discountPct: number | null;
  expectedSum: number;
};

export function buildDiscountAlertComment(
  alert: DiscountAlertCode,
  opts: { discountPct: number | null; expectedSum: number; orderLabel: string; orderIds?: number[] }
): string {
  const pctTxt = opts.discountPct != null ? `${opts.discountPct}%` : "—";
  const sumTxt =
    opts.expectedSum > 0
      ? opts.expectedSum.toLocaleString("ru-RU", { maximumFractionDigits: 2 })
      : "0";
  const ordersTxt =
    opts.orderIds && opts.orderIds.length > 1
      ? `заказы #${opts.orderIds.join(", #")}`
      : opts.orderLabel;

  if (alert === "cash_desk_missing") {
    return `Скидка — касса не настроена: ${pctTxt}, сумма ${sumTxt}, ${ordersTxt}`;
  }
  if (alert === "bonus_required") {
    return `Скидка — требуется связанный бонус: ${pctTxt}, сумма ${sumTxt}, ${ordersTxt}`;
  }
  return `Скидка — не применена: ${pctTxt}, сумма ${sumTxt}, ${ordersTxt}`;
}

export function isDiscountAlertCode(v: string): v is DiscountAlertCode {
  return (DISCOUNT_ALERT_CODES as readonly string[]).includes(v);
}

export function calcExpectedDiscountSum(
  baseSubtotal: Prisma.Decimal,
  discountPct: number | null
): number {
  if (discountPct == null || discountPct <= 0) return 0;
  const raw = baseSubtotal.mul(discountPct).div(100);
  return Number(raw.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP));
}

export async function resolveDiscountAlertForCreate(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams,
  paid: CreateOrderPaidBundle
): Promise<DiscountAlertResolution> {
  const empty = { alert: null, discountPct: null, expectedSum: 0 };
  if (p.orderType !== "order") return empty;
  if (p.input.apply_discount === false) return empty;
  if (paid.discountSum.gt(0)) return empty;

  const discountRules = await loadDiscountRulesForOrder(tx, p.tenantId);
  const usedRuleIds = await fetchClientUsedAutoBonusRuleIds(tx, p.tenantId, p.client.id);
  const stockProductIds = new Set<number>();
  for (const pid of p.qtyByProduct.keys()) stockProductIds.add(pid);
  const availableByProductId = await loadAvailableQtyByProductId(
    tx,
    p.tenantId,
    p.input.warehouse_id,
    stockProductIds
  );

  const prereqEnv = {
    tx,
    tenantId: p.tenantId,
    client: { id: p.client.id, category: p.client.category },
    orderAgent: p.orderAgentForBonus,
    orderedProductIds: p.orderedProductIds,
    productById: p.productById,
    baseSubtotalBeforeDiscount: p.totalSum,
    qtyByProduct: p.qtyByProduct,
    clientUsedAutoBonusRuleIds: usedRuleIds,
    giftOverrides: p.validatedGiftOverrides,
    warehouseId: p.input.warehouse_id,
    availableByProductId,
    ruleCache: new Map(),
    clientMonthMerchandiseSubtotalExclOrder: new Prisma.Decimal(0),
    clientMonthPaidQtyAggregateExclOrder: 0,
    clientMonthPaidQtyByProductExclOrder: new Map<number, number>()
  };

  const winning = await findWinningDiscountRuleWithPrereqs(
    discountRules,
    { id: p.client.id, category: p.client.category },
    p.orderedProductIds,
    p.productById,
    usedRuleIds,
    prereqEnv,
    new Date(),
    { baseSubtotalBeforeDiscount: p.totalSum }
  );

  const pct = winning?.discount_pct != null ? Number(winning.discount_pct) : null;
  const expectedSum = calcExpectedDiscountSum(p.totalSum, pct);

  const cashDeskOk =
    (await tx.cashDesk.count({
      where: {
        tenant_id: p.tenantId,
        is_active: true,
        accepts_discount_payments: true
      }
    })) > 0;
  if (!cashDeskOk) {
    return { alert: "cash_desk_missing", discountPct: pct, expectedSum };
  }

  if (!winning) {
    return { alert: "not_applied", discountPct: pct, expectedSum };
  }

  const bonusApplied = paid.appliedAutoBonusRuleIds.some((id) => {
    const rule = discountRules.find((r) => r.id === id);
    return rule?.type !== "discount";
  });
  if (bonusApplied && p.stackPolicy.mode !== "all") {
    return { alert: "bonus_required", discountPct: pct, expectedSum };
  }

  return { alert: "not_applied", discountPct: pct, expectedSum };
}

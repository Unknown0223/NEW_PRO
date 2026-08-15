import { Prisma } from "@prisma/client";
import type { BonusStackPolicy } from "./bonus-stack-policy";
import type { OrderAgentBonusContext } from "./order-bonus-apply";
import {
  fetchClientUsedAutoBonusRuleIds,
  fetchClientUsedAutoBonusRuleIdsExcludingOrder,
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

export type DiscountAlertEvalInput = {
  tenantId: number;
  orderType: string;
  applyDiscount: boolean;
  warehouseId: number | null | undefined;
  client: { id: number; category: string | null };
  orderAgent: OrderAgentBonusContext | null;
  qtyByProduct: Map<number, number>;
  productById: Map<number, { id: number; category_id: number | null }>;
  orderedProductIds: Set<number>;
  baseSubtotal: Prisma.Decimal;
  giftOverrides: Map<number, number>;
  stackPolicy: BonusStackPolicy;
  discountSum: Prisma.Decimal;
  appliedAutoBonusRuleIds: number[];
  /** Tahrirlashda joriy zakaz qoidalarini «allaqachon ishlatilgan» deb hisoblamaslik. */
  excludeOrderId?: number | null;
  referenceAt?: Date;
  is_consignment?: boolean;
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

/** Avto-skidka / bonus izohlarini olib tashlash (qayta hisoblashdan oldin). */
export function stripDiscountAlertComments(comment: string | null | undefined): string | null {
  if (comment == null || !comment.trim()) return null;
  const kept = comment
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => {
      const t = l.trim();
      if (!t) return true;
      if (t.startsWith("Скидка —")) return false;
      if (t.startsWith("Бонус — недостаток")) return false;
      return true;
    })
    .join("\n")
    .trim();
  return kept || null;
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

export async function resolveDiscountAlert(
  tx: Prisma.TransactionClient,
  input: DiscountAlertEvalInput
): Promise<DiscountAlertResolution> {
  const empty = { alert: null, discountPct: null, expectedSum: 0 };
  if (input.orderType !== "order") return empty;
  if (input.applyDiscount === false) return empty;
  if (input.discountSum.gt(0)) return empty;

  const discountRules = await loadDiscountRulesForOrder(tx, input.tenantId);
  const usedRuleIds =
    input.excludeOrderId != null && input.excludeOrderId > 0
      ? await fetchClientUsedAutoBonusRuleIdsExcludingOrder(
          tx,
          input.tenantId,
          input.client.id,
          input.excludeOrderId
        )
      : await fetchClientUsedAutoBonusRuleIds(tx, input.tenantId, input.client.id);

  const stockProductIds = new Set<number>();
  for (const pid of input.qtyByProduct.keys()) stockProductIds.add(pid);
  const availableByProductId = await loadAvailableQtyByProductId(
    tx,
    input.tenantId,
    input.warehouseId ?? null,
    stockProductIds
  );

  const prereqEnv = {
    tx,
    tenantId: input.tenantId,
    client: { id: input.client.id, category: input.client.category },
    orderAgent: input.orderAgent,
    orderedProductIds: input.orderedProductIds,
    productById: input.productById,
    baseSubtotalBeforeDiscount: input.baseSubtotal,
    qtyByProduct: input.qtyByProduct,
    clientUsedAutoBonusRuleIds: usedRuleIds,
    giftOverrides: input.giftOverrides,
    warehouseId: input.warehouseId ?? null,
    availableByProductId,
    ruleCache: new Map(),
    clientMonthMerchandiseSubtotalExclOrder: new Prisma.Decimal(0),
    clientMonthPaidQtyAggregateExclOrder: 0,
    clientMonthPaidQtyByProductExclOrder: new Map<number, number>(),
    is_consignment: input.is_consignment === true
  };

  const winning = await findWinningDiscountRuleWithPrereqs(
    discountRules,
    { id: input.client.id, category: input.client.category },
    input.orderedProductIds,
    input.productById,
    usedRuleIds,
    prereqEnv,
    input.referenceAt ?? new Date(),
    { baseSubtotalBeforeDiscount: input.baseSubtotal }
  );

  const pct = winning?.discount_pct != null ? Number(winning.discount_pct) : null;
  const expectedSum = calcExpectedDiscountSum(input.baseSubtotal, pct);

  const cashDeskOk =
    (await tx.cashDesk.count({
      where: {
        tenant_id: input.tenantId,
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

  const bonusApplied = input.appliedAutoBonusRuleIds.some((id) => {
    const rule = discountRules.find((r) => r.id === id);
    return rule?.type !== "discount";
  });
  if (bonusApplied && input.stackPolicy.mode !== "all") {
    return { alert: "bonus_required", discountPct: pct, expectedSum };
  }

  return { alert: "not_applied", discountPct: pct, expectedSum };
}

export async function resolveDiscountAlertForCreate(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams,
  paid: CreateOrderPaidBundle
): Promise<DiscountAlertResolution> {
  return resolveDiscountAlert(tx, {
    tenantId: p.tenantId,
    orderType: p.orderType,
    applyDiscount: p.input.apply_discount !== false,
    warehouseId: p.input.warehouse_id,
    client: { id: p.client.id, category: p.client.category },
    orderAgent: p.orderAgentForBonus,
    qtyByProduct: p.qtyByProduct,
    productById: p.productById,
    orderedProductIds: p.orderedProductIds,
    baseSubtotal: p.totalSum,
    giftOverrides: p.validatedGiftOverrides,
    stackPolicy: p.stackPolicy,
    discountSum: paid.discountSum,
    appliedAutoBonusRuleIds: paid.appliedAutoBonusRuleIds,
    is_consignment: p.input.is_consignment === true
  });
}

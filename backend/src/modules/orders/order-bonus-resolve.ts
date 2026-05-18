import { Prisma, Prisma as PrismaClient } from "@prisma/client";
import { bonusRuleInclude, mapBonusRuleFull, type BonusRuleRow } from "../bonus-rules/bonus-rules.service";
import { resolveBonusSlotTakeCount, type BonusStackPolicy } from "./bonus-stack-policy";
import {
  activeRuleWhere,
  applyDiscountWithRule,
  BONUS_SUM_THRESHOLD_TIMEZONE,
  buildSumBonusDraft,
  fetchClientMonthMerchandiseSubtotalExclOrder,
  fetchClientMonthPaidQtyAggregateExclOrder,
  fetchClientMonthPaidQtyByProductExclOrder,
  findQtyBonusPeeks,
  findWinningDiscountRuleWithPrereqs,
  findWinningSumPeek,
  loadAvailableQtyByProductId,
  materializeQtyPeeks,
  roundMoney,
  type BonusLineDraft,
  type OrderAgentBonusContext,
  type OrderBonusPrereqEnv,
  type PaidLineDraft,
  type ProductLite,
  type QtyBonusPeek,
  type SumBonusPeek
} from "./order-bonus-rules";

type BonusSlot =
  | { kind: "discount"; priority: number; rule: BonusRuleRow }
  | { kind: "sum"; priority: number; peek: SumBonusPeek }
  | { kind: "qty"; priority: number; peek: QtyBonusPeek };

function slotSortKey(s: BonusSlot): string {
  if (s.kind === "discount") return `d:${s.rule.id}`;
  if (s.kind === "sum") return `s:${s.peek.rule.id}`;
  return `q:${s.peek.rule.id}:p${s.peek.purchasedPid}`;
}

/**
 * Chegirma + summa + qty ni `bonus_stack` siyosati bo‘yicha birlashtiradi.
 */
export async function resolveOrderBonusesForCreate(
  tx: Prisma.TransactionClient,
  tenantId: number,
  client: { id: number; category: string | null },
  paidLines: PaidLineDraft[],
  paidTotal: PrismaClient.Decimal,
  baseSubtotalBeforeDiscount: PrismaClient.Decimal,
  qtyByProduct: ReadonlyMap<number, number>,
  productById: ReadonlyMap<number, ProductLite>,
  orderedProductIds: ReadonlySet<number>,
  stackPolicy: BonusStackPolicy,
  clientUsedAutoBonusRuleIds: ReadonlySet<number> = new Set(),
  qtyBonusGiftOverrides: ReadonlyMap<number, number> = new Map(),
  warehouseId?: number | null,
  calendarContext?: { referenceAt: Date; excludeOrderId?: number },
  orderAgent: OrderAgentBonusContext | null = null
): Promise<{
  lines: PaidLineDraft[];
  total: PrismaClient.Decimal;
  bonusDrafts: BonusLineDraft[];
  appliedAutoBonusRuleIds: number[];
}> {
  const now = new Date();
  const [discountRules, sumRaw, qtyRaw] = await Promise.all([
    loadDiscountRulesForOrder(tx, tenantId),
    tx.bonusRule.findMany({
      where: activeRuleWhere(tenantId, "sum", now),
      include: bonusRuleInclude,
      orderBy: { priority: "desc" }
    }),
    tx.bonusRule.findMany({
      where: activeRuleWhere(tenantId, "qty", now),
      include: bonusRuleInclude,
      orderBy: { priority: "desc" }
    })
  ]);
  const sumRules = sumRaw.map((r) => mapBonusRuleFull(r));
  const qtyRules = qtyRaw.map((r) => mapBonusRuleFull(r));

  const stockProductIds = new Set<number>();
  for (const pid of qtyByProduct.keys()) stockProductIds.add(pid);
  for (const r of [...discountRules, ...sumRules, ...qtyRules]) {
    for (const id of r.bonus_product_ids) stockProductIds.add(id);
  }
  const availableByProductId = await loadAvailableQtyByProductId(tx, tenantId, warehouseId, stockProductIds);

  const refAt = calendarContext?.referenceAt ?? new Date();
  const clientMonthMerchandiseSubtotalExclOrder = await fetchClientMonthMerchandiseSubtotalExclOrder(tx, {
    tenantId,
    clientId: client.id,
    referenceAt: refAt,
    excludeOrderId: calendarContext?.excludeOrderId,
    timeZone: BONUS_SUM_THRESHOLD_TIMEZONE
  });

  const needsQtyMonth = qtyRules.some(
    (r) => (r.sum_threshold_scope ?? "order") === "calendar_month"
  );
  const [clientMonthPaidQtyAggregateExclOrder, clientMonthPaidQtyByProductExclOrder] =
    needsQtyMonth
      ? await Promise.all([
          fetchClientMonthPaidQtyAggregateExclOrder(tx, {
            tenantId,
            clientId: client.id,
            referenceAt: refAt,
            excludeOrderId: calendarContext?.excludeOrderId,
            timeZone: BONUS_SUM_THRESHOLD_TIMEZONE
          }),
          fetchClientMonthPaidQtyByProductExclOrder(tx, {
            tenantId,
            clientId: client.id,
            referenceAt: refAt,
            excludeOrderId: calendarContext?.excludeOrderId,
            timeZone: BONUS_SUM_THRESHOLD_TIMEZONE
          })
        ])
      : [0, new Map<number, number>()];

  const prereqEnv: OrderBonusPrereqEnv = {
    tx,
    tenantId,
    client,
    orderAgent,
    orderedProductIds,
    productById,
    baseSubtotalBeforeDiscount,
    qtyByProduct,
    clientUsedAutoBonusRuleIds,
    giftOverrides: qtyBonusGiftOverrides,
    warehouseId,
    availableByProductId,
    ruleCache: new Map(),
    clientMonthMerchandiseSubtotalExclOrder,
    clientMonthPaidQtyAggregateExclOrder,
    clientMonthPaidQtyByProductExclOrder
  };

  const discountRule = await findWinningDiscountRuleWithPrereqs(
    discountRules,
    client,
    orderedProductIds,
    productById,
    clientUsedAutoBonusRuleIds,
    prereqEnv,
    now
  );

  const sumPeek = await findWinningSumPeek(
    tx,
    tenantId,
    client,
    baseSubtotalBeforeDiscount,
    orderedProductIds,
    productById,
    clientUsedAutoBonusRuleIds,
    qtyByProduct,
    { rules: sumRules, prereqEnv }
  );

  const qtyPeeks = await findQtyBonusPeeks(
    tx,
    tenantId,
    client,
    qtyByProduct,
    productById,
    orderedProductIds,
    clientUsedAutoBonusRuleIds,
    qtyBonusGiftOverrides,
    warehouseId,
    { rules: qtyRules, prereqEnv, availableByProductId }
  );

  const slots: BonusSlot[] = [];
  if (discountRule) {
    slots.push({ kind: "discount", priority: discountRule.priority, rule: discountRule });
  }
  if (sumPeek) {
    slots.push({ kind: "sum", priority: sumPeek.rule.priority, peek: sumPeek });
  }
  for (const qp of qtyPeeks) {
    slots.push({ kind: "qty", priority: qp.rule.priority, peek: qp });
  }

  slots.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return slotSortKey(a).localeCompare(slotSortKey(b));
  });

  const take = resolveBonusSlotTakeCount(slots.length, stackPolicy);
  const chosen = slots.slice(0, take);

  let lines = paidLines.map((l) => ({ ...l }));
  let total = paidTotal;

  if (chosen.some((s) => s.kind === "discount") && discountRule) {
    const applied = applyDiscountWithRule(discountRule, lines, total);
    lines = applied.lines;
    total = applied.total;
  }

  const bonusParts: BonusLineDraft[] = [];

  if (chosen.some((s) => s.kind === "sum") && sumPeek) {
    bonusParts.push(...(await buildSumBonusDraft(tenantId, sumPeek.giftPid, sumPeek.units)));
  }

  const chosenQty = chosen.filter((s): s is BonusSlot & { kind: "qty" } => s.kind === "qty");
  if (chosenQty.length > 0) {
    bonusParts.push(...(await materializeQtyPeeks(tenantId, chosenQty.map((s) => s.peek))));
  }

  const appliedOnceRuleIds: number[] = [];
  if (chosen.some((s) => s.kind === "discount") && discountRule?.once_per_client) {
    appliedOnceRuleIds.push(discountRule.id);
  }
  if (chosen.some((s) => s.kind === "sum") && sumPeek?.rule.once_per_client) {
    appliedOnceRuleIds.push(sumPeek.rule.id);
  }
  for (const s of chosenQty) {
    if (s.peek.rule.once_per_client) {
      appliedOnceRuleIds.push(s.peek.rule.id);
    }
  }
  const uniqueApplied = [...new Set(appliedOnceRuleIds)];

  return {
    lines,
    total,
    bonusDrafts: mergeBonusLineDrafts(bonusParts),
    appliedAutoBonusRuleIds: uniqueApplied
  };
}

export function mergeBonusLineDrafts(drafts: BonusLineDraft[]): BonusLineDraft[] {
  const map = new Map<number, { qty: PrismaClient.Decimal; price: PrismaClient.Decimal }>();
  for (const d of drafts) {
    const cur = map.get(d.product_id);
    if (!cur) {
      map.set(d.product_id, { qty: d.qty, price: d.price });
    } else {
      map.set(d.product_id, {
        qty: cur.qty.add(d.qty),
        price: d.price
      });
    }
  }
  const out: BonusLineDraft[] = [];
  for (const [product_id, { qty, price }] of map) {
    out.push({
      product_id,
      qty,
      price,
      total: roundMoney(qty.mul(price)),
      is_bonus: true
    });
  }
  return out;
}

export async function loadDiscountRulesForOrder(
  tx: Prisma.TransactionClient,
  tenantId: number
): Promise<BonusRuleRow[]> {
  const now = new Date();
  const raw = await tx.bonusRule.findMany({
    where: activeRuleWhere(tenantId, "discount", now),
    include: bonusRuleInclude,
    orderBy: { priority: "desc" }
  });
  return raw.map((r) => mapBonusRuleFull(r));
}


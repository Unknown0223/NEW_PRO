import { Prisma } from "@prisma/client";
import { fetchClientUsedAutoBonusRuleIds, resolveOrderBonusesForCreate } from "../order-bonus-apply";
import { roundOrderMoney } from "./order.detail-mappers";
import type { CreateOrderTxParams } from "./order.create-tx.types";

export type CreateOrderPaidBundle = {
  paidAfterDisc: CreateOrderTxParams["lineData"];
  paidTotal: Prisma.Decimal;
  bonusCreates: Array<{
    product_id: number;
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
    is_bonus: true;
  }>;
  bonusSum: Prisma.Decimal;
  discountSum: Prisma.Decimal;
  appliedAutoBonusRuleIds: number[];
};

export async function resolveCreateOrderPaidBundle(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams
): Promise<CreateOrderPaidBundle> {
  const {
    tenantId,
    input,
    client,
    orderType,
    lineData,
    totalSum,
    qtyByProduct,
    productById,
    orderedProductIds,
    orderAgentForBonus,
    validatedGiftOverrides,
    isInboundShelfReturn,
    stackPolicy
  } = p;

  const applyBonus =
    isInboundShelfReturn || orderType === "exchange" ? false : (input.apply_bonus ?? true);
  let paidAfterDisc = lineData;
  let paidTotal = totalSum;
  let bonusDrafts: Array<{
    product_id: number;
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
  }> = [];
  let appliedAutoBonusRuleIds: number[] = [];
  if (applyBonus) {
    const usedRuleIds = await fetchClientUsedAutoBonusRuleIds(tx, tenantId, client.id);
    const resolved = await resolveOrderBonusesForCreate(
      tx,
      tenantId,
      { id: client.id, category: client.category },
      lineData,
      totalSum,
      totalSum,
      qtyByProduct,
      productById,
      orderedProductIds,
      stackPolicy,
      usedRuleIds,
      validatedGiftOverrides,
      input.warehouse_id,
      { referenceAt: new Date() },
      orderAgentForBonus
    );
    paidAfterDisc = resolved.lines;
    paidTotal = resolved.total;
    bonusDrafts = resolved.bonusDrafts;
    appliedAutoBonusRuleIds = resolved.appliedAutoBonusRuleIds;
  }

  let bonusSum = new Prisma.Decimal(0);
  const bonusCreates = bonusDrafts.map((b) => {
    bonusSum = bonusSum.add(b.total);
    return {
      product_id: b.product_id,
      qty: b.qty,
      price: b.price,
      total: b.total,
      is_bonus: true as const
    };
  });

  const rawDisc = totalSum.sub(paidTotal);
  const discountSum =
    applyBonus && rawDisc.gt(0) ? roundOrderMoney(rawDisc) : new Prisma.Decimal(0);

  return {
    paidAfterDisc,
    paidTotal,
    bonusCreates,
    bonusSum,
    discountSum,
    appliedAutoBonusRuleIds
  };
}

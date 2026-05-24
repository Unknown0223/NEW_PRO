import { prisma } from "../../config/database";
import type { ProductReturnPool } from "./returns-bonus-reverse.pools";

export type PolkiAllocationMode = "same" | "peresort" | "mixed";

export type InterchangeableSibling = { id: number; name: string };

export async function loadInterchangeableSiblingsByProductId(
  tenantId: number
): Promise<Map<number, InterchangeableSibling[]>> {
  const groups = await prisma.interchangeableProductGroup.findMany({
    where: { tenant_id: tenantId, is_active: true },
    include: {
      products: {
        include: { product: { select: { id: true, name: true } } }
      }
    }
  });
  const map = new Map<number, InterchangeableSibling[]>();
  for (const g of groups) {
    const prods = g.products.map((l) => l.product);
    for (const p of prods) {
      const siblings = prods
        .filter((x) => x.id !== p.id)
        .map((x) => ({ id: x.id, name: x.name }));
      if (siblings.length > 0) map.set(p.id, siblings);
    }
  }
  return map;
}

/** Avto-peresort: manba pool yetmasa eng katta bonus-pool li sibling. */
export function resolveAutoPeresortWarehouse(input: {
  sourceProductId: number;
  sourceName: string;
  bonusQty: number;
  paidQty: number;
  poolByProduct: Map<number, ProductReturnPool>;
  siblings?: InterchangeableSibling[];
  unitPriceBonus: number;
}): {
  bonus_warehouse_product_id: number;
  bonus_warehouse_product_name: string;
  allocation_mode: PolkiAllocationMode;
  peresort_debt_amount: number;
} {
  const {
    sourceProductId,
    sourceName,
    bonusQty,
    paidQty,
    poolByProduct,
    siblings,
    unitPriceBonus
  } = input;

  if (bonusQty <= 0) {
    return {
      bonus_warehouse_product_id: sourceProductId,
      bonus_warehouse_product_name: sourceName,
      allocation_mode: "same",
      peresort_debt_amount: 0
    };
  }

  const sourcePool = poolByProduct.get(sourceProductId)?.max_bonus ?? 0;
  let targetId = sourceProductId;
  let targetName = sourceName;

  if (sourcePool < bonusQty && siblings?.length) {
    let best: { id: number; name: string; pool: number } | null = null;
    for (const s of siblings) {
      const pool = poolByProduct.get(s.id)?.max_bonus ?? 0;
      if (pool >= bonusQty) {
        if (!best || pool > best.pool) best = { id: s.id, name: s.name, pool };
      }
    }
    if (!best) {
      for (const s of siblings) {
        const pool = poolByProduct.get(s.id)?.max_bonus ?? 0;
        if (!best || pool > best.pool) best = { id: s.id, name: s.name, pool };
      }
    }
    if (best) {
      targetId = best.id;
      targetName = best.name;
    }
  }

  const targetPool = poolByProduct.get(targetId)?.max_bonus ?? 0;
  const shortQty = Math.max(0, bonusQty - targetPool);
  const unitPaid = poolByProduct.get(sourceProductId)?.unit_price_paid ?? 0;
  const price = unitPriceBonus > 0 ? unitPriceBonus : unitPaid;
  const peresort_debt_amount = targetId !== sourceProductId ? shortQty * price : 0;

  let allocation_mode: PolkiAllocationMode = "same";
  if (targetId !== sourceProductId) {
    allocation_mode = paidQty > 0 ? "mixed" : "peresort";
  }

  return {
    bonus_warehouse_product_id: targetId,
    bonus_warehouse_product_name: targetName,
    allocation_mode,
    peresort_debt_amount
  };
}

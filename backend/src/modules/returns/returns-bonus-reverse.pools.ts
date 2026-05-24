import type { OrderItemSummary } from "./returns-enhanced.types";

export type ProductReturnPool = {
  max_paid: number;
  max_bonus: number;
  unit_price_paid: number;
  unit_price_bonus: number;
};

function pieceQty(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n + 1e-9);
}

export function buildProductReturnPools(items: OrderItemSummary[]): Map<number, ProductReturnPool> {
  const poolByProduct = new Map<number, ProductReturnPool>();
  const bonusProductIds = new Set<number>();

  for (const it of items) {
    const q = pieceQty(Number.parseFloat(String(it.qty).replace(/\s/g, "").replace(",", ".")));
    if (q <= 0) continue;
    const price = Number.parseFloat(String(it.price).replace(/\s/g, "").replace(",", "."));
    const up = Number.isFinite(price) ? price : 0;
    const pid = it.product_id;
    const cur = poolByProduct.get(pid) ?? {
      max_paid: 0,
      max_bonus: 0,
      unit_price_paid: up,
      unit_price_bonus: up
    };
    if (it.is_bonus) {
      cur.max_bonus += q;
      cur.unit_price_bonus = up;
      bonusProductIds.add(pid);
    } else {
      cur.max_paid += q;
      cur.unit_price_paid = up;
    }
    poolByProduct.set(pid, cur);
  }

  // Bonus faqat zakazda bonus qatori bor mahsulotlarda; qolganlar faqat опл.
  if (bonusProductIds.size > 0) {
    for (const [pid, cur] of poolByProduct) {
      if (!bonusProductIds.has(pid) && cur.max_bonus > 0) {
        cur.max_paid += cur.max_bonus;
        cur.max_bonus = 0;
      }
      poolByProduct.set(pid, cur);
    }
  }

  return poolByProduct;
}

import type { PolkiClientItem, PolkiPairRowModel } from "../../types";
import { parsePriceAmount, polkiPieceQtyFromNumber } from "../../utils";
import { formatPolkiMoneySum, formatPolkiQtyDisplay } from "./polki-format-display";

export type PolkiOrderCompositionLine = {
  productId: number;
  name: string;
  sku: string;
  qty: number;
  sum: number;
};

export type PolkiOrderCompositionSummary = {
  paidLines: PolkiOrderCompositionLine[];
  bonusLines: PolkiOrderCompositionLine[];
  paidQtyTotal: number;
  paidSumTotal: number;
  bonusQtyTotal: number;
};

function parseItemQty(raw: string): number {
  const n = Number.parseFloat(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Zakaz qatorlari: floor + yo‘qolgan butun donalar va ajralmas bonusni bitta mahsulotga yig‘ish. */
export function rebalancePolkiOrderPieceTotals(
  rows: PolkiPairRowModel[],
  items: PolkiClientItem[],
  orderId: number
): PolkiPairRowModel[] {
  const orderRows = rows.filter((r) => r.order_id === orderId);
  if (orderRows.length === 0) return rows;

  const orderItems = items.filter((it) => (it.order_id ?? 0) === orderId);
  if (orderItems.length === 0) return rows;

  let rawPaidSum = 0;
  let rawBonusSum = 0;
  const paidFracByProduct = new Map<number, number>();
  const bonusFracByProduct = new Map<number, number>();
  const bonusProductIds = new Set<number>();

  for (const it of orderItems) {
    const qRaw = parseItemQty(it.qty);
    if (qRaw <= 0) continue;
    const qFloor = polkiPieceQtyFromNumber(qRaw);
    const frac = qRaw - qFloor;
    const pid = it.product_id;
    if (it.is_bonus) {
      rawBonusSum += qRaw;
      if (qFloor > 0) bonusProductIds.add(pid);
      if (frac > 1e-9) {
        bonusFracByProduct.set(pid, (bonusFracByProduct.get(pid) ?? 0) + frac);
      }
    } else {
      rawPaidSum += qRaw;
      if (frac > 1e-9) {
        paidFracByProduct.set(pid, (paidFracByProduct.get(pid) ?? 0) + frac);
      }
    }
  }

  const targetPaid = Math.round(rawPaidSum);
  const targetBonus = Math.round(rawBonusSum);
  const currentPaid = orderRows.reduce((s, r) => s + r.max_paid, 0);
  const currentBonus = orderRows.reduce((s, r) => s + r.max_bonus, 0);

  const mutable = orderRows.map((r) => ({ ...r }));
  let paidSlack = Math.max(0, targetPaid - currentPaid);
  let bonusSlack = Math.max(0, targetBonus - currentBonus);

  const sortForPaidSlack = () =>
    [...mutable].sort((a, b) => {
      const fa = paidFracByProduct.get(a.product_id) ?? 0;
      const fb = paidFracByProduct.get(b.product_id) ?? 0;
      if (fb !== fa) return fb - fa;
      return b.max_paid - a.max_paid;
    });

  while (paidSlack > 0) {
    const ranked = sortForPaidSlack();
    let moved = false;
    for (const r of ranked) {
      if (paidSlack <= 0) break;
      const idx = mutable.findIndex((x) => x.pair_key === r.pair_key);
      if (idx < 0) continue;
      mutable[idx]!.max_paid += 1;
      paidSlack -= 1;
      moved = true;
    }
    if (!moved) break;
  }

  if (bonusSlack > 0) {
    const pickBonusRow = (): (typeof mutable)[number] | undefined => {
      const withBonusLine = mutable.filter((r) => bonusProductIds.has(r.product_id));
      if (withBonusLine.length === 1) return withBonusLine[0];
      if (withBonusLine.length > 1) {
        return [...withBonusLine].sort(
          (a, b) =>
            (bonusFracByProduct.get(b.product_id) ?? 0) -
              (bonusFracByProduct.get(a.product_id) ?? 0) || b.max_bonus - a.max_bonus
        )[0];
      }
      return [...mutable].sort((a, b) => b.max_paid - a.max_paid)[0];
    };

    const target = pickBonusRow();
    if (target) {
      const idx = mutable.findIndex((x) => x.pair_key === target.pair_key);
      if (idx >= 0) {
        mutable[idx]!.max_bonus += bonusSlack;
        bonusSlack = 0;
      }
    } else {
      for (const r of sortForPaidSlack()) {
        if (bonusSlack <= 0) break;
        const idx = mutable.findIndex((x) => x.pair_key === r.pair_key);
        if (idx < 0) continue;
        mutable[idx]!.max_bonus += 1;
        bonusSlack -= 1;
      }
    }
  }

  // Bonus faqat zakazda bonus qatori bor mahsulotda qoladi.
  if (bonusProductIds.size > 0) {
    for (const r of mutable) {
      if (!bonusProductIds.has(r.product_id) && r.max_bonus > 0) {
        r.max_paid = polkiPieceQtyFromNumber(r.max_paid + r.max_bonus);
        r.max_bonus = 0;
      }
    }
  }

  const byKey = new Map(mutable.map((r) => [r.pair_key, r]));
  return rows.map((r) => (r.order_id === orderId ? (byKey.get(r.pair_key) ?? r) : r));
}

export function applyPolkiOrderPieceRebalance(
  rows: PolkiPairRowModel[],
  items: PolkiClientItem[]
): PolkiPairRowModel[] {
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter((id) => id > 0))];
  let out = rows;
  for (const oid of orderIds) {
    out = rebalancePolkiOrderPieceTotals(out, items, oid);
  }
  return out;
}

export function summarizePolkiOrderRows(rows: PolkiPairRowModel[]): PolkiOrderCompositionSummary {
  const paidLines: PolkiOrderCompositionLine[] = [];
  const bonusLines: PolkiOrderCompositionLine[] = [];

  for (const r of rows) {
    if (r.max_paid > 0) {
      paidLines.push({
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        qty: r.max_paid,
        sum: r.max_paid * r.unit_price_paid
      });
    }
    if (r.max_bonus > 0) {
      const unit = r.unit_price_bonus > 0 ? r.unit_price_bonus : r.unit_price_paid;
      bonusLines.push({
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        qty: r.max_bonus,
        sum: r.max_bonus * unit
      });
    }
  }

  paidLines.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  bonusLines.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const paidQtyTotal = paidLines.reduce((s, l) => s + l.qty, 0);
  const paidSumTotal = paidLines.reduce((s, l) => s + l.sum, 0);
  const bonusQtyTotal = bonusLines.reduce((s, l) => s + l.qty, 0);

  return { paidLines, bonusLines, paidQtyTotal, paidSumTotal, bonusQtyTotal };
}

export function summarizePolkiOrderFromItems(items: PolkiClientItem[], orderId: number): PolkiOrderCompositionSummary {
  const paidMap = new Map<number, PolkiOrderCompositionLine>();
  const bonusMap = new Map<number, PolkiOrderCompositionLine>();

  for (const it of items) {
    if ((it.order_id ?? 0) !== orderId) continue;
    const q = polkiPieceQtyFromNumber(parseItemQty(it.qty));
    if (q <= 0) continue;
    const price = parsePriceAmount(it.price);
    const map = it.is_bonus ? bonusMap : paidMap;
    const cur = map.get(it.product_id);
    if (!cur) {
      map.set(it.product_id, {
        productId: it.product_id,
        name: it.name,
        sku: it.sku,
        qty: q,
        sum: q * price
      });
    } else {
      cur.qty += q;
      cur.sum += q * price;
    }
  }

  const paidLines = [...paidMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const bonusLines = [...bonusMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return {
    paidLines,
    bonusLines,
    paidQtyTotal: paidLines.reduce((s, l) => s + l.qty, 0),
    paidSumTotal: paidLines.reduce((s, l) => s + l.sum, 0),
    bonusQtyTotal: bonusLines.reduce((s, l) => s + l.qty, 0)
  };
}

export function formatCompositionQty(qty: number): string {
  return formatPolkiQtyDisplay(qty);
}

export function formatCompositionSum(sum: number): string {
  return formatPolkiMoneySum(sum);
}

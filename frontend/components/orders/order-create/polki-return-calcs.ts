import type { PolkiPairRowModel } from "./types";
import { parsePriceAmount, polkiSplitTotal } from "./utils";

export type PolkiExplicitSplit = { paid: number; bonus: number };

export type PolkiLineSplit = {
  effPaid: number;
  effBonus: number;
  defer: boolean;
  physBonus: number;
};

export function resolvePolkiLineSplit(input: {
  row: PolkiPairRowModel;
  totalQty: number;
  explicit?: PolkiExplicitSplit;
  deferToBalance: boolean;
  autoBonusApplied: boolean;
}): PolkiLineSplit {
  const { effPaid, effBonus } = input.explicit
    ? { effPaid: input.explicit.paid, effBonus: input.explicit.bonus }
    : polkiSplitTotal(input.row, input.totalQty);
  const defer = input.autoBonusApplied ? false : input.deferToBalance;
  return { effPaid, effBonus, defer, physBonus: defer ? 0 : effBonus };
}

export function maxBonusPoolByProduct(rows: PolkiPairRowModel[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    m.set(r.product_id, (m.get(r.product_id) ?? 0) + r.max_bonus);
  }
  return m;
}

export function resolvePeresortTarget(
  row: PolkiPairRowModel,
  peresortByPairKey: Record<string, number> | undefined,
  siblings: Array<{ id: number }> | undefined
): number {
  const raw = peresortByPairKey?.[row.pair_key];
  if (raw == null || raw === row.product_id) return row.product_id;
  if (siblings?.some((s) => s.id === raw)) return raw;
  return row.product_id;
}

/** Bonus boshqa SKU ga — yetmaydigan qism → qarz (so‘m). */
export function peresortBonusDebtAmount(
  bonusQty: number,
  targetProductId: number,
  sourceProductId: number,
  poolByProduct: Map<number, number>,
  unitPriceBonus: number
): number {
  if (bonusQty <= 0 || targetProductId === sourceProductId) return 0;
  const pool = poolByProduct.get(targetProductId) ?? 0;
  const shortQty = Math.max(0, bonusQty - pool);
  const price = unitPriceBonus > 0 ? unitPriceBonus : 0;
  return shortQty * price;
}

export function polkiLineCashCap(
  row: PolkiPairRowModel,
  defer: boolean,
  physBonus: number
): number {
  if (row.max_bonus <= 0) return 0;
  return defer
    ? row.max_bonus * row.unit_price_bonus
    : Math.max(0, (row.max_bonus - physBonus) * row.unit_price_bonus);
}

export function polkiDeferDebtHint(
  effBonus: number,
  unitPriceBonus: number,
  cashParsed: number,
  cashCap: number
): number {
  if (effBonus <= 0) return 0;
  const suggested = effBonus * unitPriceBonus;
  return Math.max(0, suggested - Math.min(cashParsed, cashCap));
}

export function parsePolkiTotalQty(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function sumPolkiCashLine(
  row: PolkiPairRowModel,
  pk: string,
  polkiBonusCash: Record<string, string>,
  cashCap: number
): number {
  if (row.max_bonus <= 0) return 0;
  return Math.min(parsePriceAmount(polkiBonusCash[pk] ?? ""), cashCap);
}

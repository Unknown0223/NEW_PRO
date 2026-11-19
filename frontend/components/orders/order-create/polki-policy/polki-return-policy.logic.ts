/**
 * PolkiReturnPolicy — pure (ADR-008 M1.3).
 * Existing helpers: utils + polki-order-composition + polki-bonus-balance.
 */
import type { ProductRow } from "@/lib/product-types";
import type { PolkiClientItem, PolkiOrderPickRow, PolkiPairRowModel } from "../types";
import {
  buildPolkiPairRows,
  capPolkiQtyToRow,
  isPolkiReturnByOrderPickable,
  polkiProductMaxReturnPool,
  polkiRowMaxReturnQty,
  polkiSplitTotal
} from "../utils";
import { applyPolkiOrderPieceRebalance } from "../view/polki-shelf-return/polki-order-composition";
import { parsePolkiQty } from "../polki-bonus-balance.logic";

export {
  buildPolkiPairRows,
  capPolkiQtyToRow,
  isPolkiReturnByOrderPickable,
  polkiProductMaxReturnPool,
  polkiRowMaxReturnQty,
  polkiSplitTotal,
  parsePolkiQty,
  applyPolkiOrderPieceRebalance
};

/** Eligible by-order pick list (pickable + balance filter). */
export function filterEligiblePolkiOrders(
  orders: PolkiOrderPickRow[],
  eligibleIds: Set<number>,
  balancesReady: boolean
): PolkiOrderPickRow[] {
  return orders
    .filter(isPolkiReturnByOrderPickable)
    .filter((o) => !balancesReady || eligibleIds.has(o.id));
}

/** Public: composition rebalance (by-order piece totals). */
export function rebalanceComposition(
  rows: PolkiPairRowModel[],
  items: PolkiClientItem[]
): PolkiPairRowModel[] {
  return applyPolkiOrderPieceRebalance(rows, items);
}

/** Public: max return qty for one pair row. */
export function maxReturnQty(
  row: Pick<PolkiPairRowModel, "max_paid" | "max_bonus">
): number {
  return polkiRowMaxReturnQty(row);
}

/** Public: product-level return pool across rows. */
export function productMaxReturn(
  rows: PolkiPairRowModel[],
  productId: number
): number {
  return polkiProductMaxReturnPool(rows, productId);
}

/** Public: cap entered qty to row max. */
export function setReturnQtyCapped(
  row: Pick<PolkiPairRowModel, "max_paid" | "max_bonus">,
  qty: number
): number {
  return capPolkiQtyToRow(row, qty);
}

export type CanShowPolkiGridInput = {
  isPolkiSheet: boolean;
  hasClient: boolean;
  hasWarehouse: boolean;
  isPolkiFree: boolean;
  isPolkiByOrder: boolean;
  selectedOrderCount: number;
};

/** Public derived gate — grid / auto-bonus enable. */
export function canShowPolkiGrid(input: CanShowPolkiGridInput): boolean {
  return (
    input.isPolkiSheet &&
    input.hasClient &&
    input.hasWarehouse &&
    (input.isPolkiFree || (input.isPolkiByOrder && input.selectedOrderCount > 0))
  );
}

export type BuildPolkiRowsInput = {
  items: PolkiClientItem[];
  products: ProductRow[];
  /** Free period: aggregate by product; by-order: rebalance pieces. */
  isPolkiFree: boolean;
};

/** Build pair rows + optional rebalance (by-order). */
export function buildPolkiRows(input: BuildPolkiRowsInput): PolkiPairRowModel[] {
  const built = buildPolkiPairRows(input.items, input.products, {
    aggregateByProduct: input.isPolkiFree
  });
  if (input.isPolkiFree) return built;
  return rebalanceComposition(built, input.items);
}

export type PolkiSubmitLine = {
  order_id?: number;
  product_id: number;
  paid_qty: number;
  bonus_qty: number;
  bonus_cash: number;
  return_qty?: number;
};

export type PolkiSubmitSliceInput = {
  rows: PolkiPairRowModel[];
  polkiTotalQty: Record<string, string>;
  polkiBonusToBalance: Record<string, boolean>;
  polkiBonusCash: Record<string, string>;
  polkiBonusGoodsQty: Record<string, number>;
  polkiBonusCashQty: Record<string, number>;
  polkiPeresortByPairKey: Record<string, number>;
  polkiAutoBonusExplicitByPairKey: Record<string, { paid: number; bonus: number }>;
  polkiAutoBonusPeresortByPairKey: Record<string, number>;
  polkiUsesAutoBonus: boolean;
  isPolkiFree: boolean;
  isPolkiByOrder: boolean;
  polkiBonusCalcMode: "manual" | "auto";
};

export type PolkiSubmitSlice = {
  usePeriodBatch: boolean;
  batchLines: PolkiSubmitLine[];
  /** product_id → paid/bonus/cash (non-batch period merge). */
  periodMerge: Map<number, { paid: number; bonus: number; cash: number }>;
  returnQtyByProduct: Map<number, number>;
  /** Period-batch row lacked order_id (composer throws polki_missing_order). */
  missingOrderId: boolean;
};

/**
 * Public: polki submit slice — lines / merge maps (API body yo‘q, pure).
 */
export function buildPolkiSubmitSlice(input: PolkiSubmitSliceInput): PolkiSubmitSlice {
  const {
    rows,
    polkiTotalQty,
    polkiBonusToBalance,
    polkiBonusCash,
    polkiBonusGoodsQty,
    polkiBonusCashQty,
    polkiPeresortByPairKey,
    polkiAutoBonusExplicitByPairKey,
    polkiAutoBonusPeresortByPairKey,
    polkiUsesAutoBonus,
    isPolkiFree,
    isPolkiByOrder,
    polkiBonusCalcMode
  } = input;

  const distinctOrderCount = new Set(rows.map((row) => row.order_id)).size;
  const usePeriodBatch = isPolkiFree && distinctOrderCount > 1;

  const batchLines: PolkiSubmitLine[] = [];
  const periodMerge = new Map<number, { paid: number; bonus: number; cash: number }>();
  const returnQtyByProduct = new Map<number, number>();
  let missingOrderId = false;

  if (polkiUsesAutoBonus) {
    for (const r of rows) {
      const pk = r.pair_key;
      const t = parsePolkiQty(polkiTotalQty[pk] ?? "");
      const capped = capPolkiQtyToRow(r, t);
      if (capped > 0) {
        const poolMax = polkiProductMaxReturnPool(rows, r.product_id);
        const prev = returnQtyByProduct.get(r.product_id) ?? 0;
        returnQtyByProduct.set(
          r.product_id,
          Math.min(prev + capped, poolMax > 0 ? poolMax : prev + capped)
        );
      }
    }
  }

  for (const r of rows) {
    const pk = r.pair_key;
    const totalParsed = parsePolkiQty(polkiTotalQty[pk] ?? "");
    const explicit = polkiUsesAutoBonus ? polkiAutoBonusExplicitByPairKey[pk] : undefined;
    const { effPaid, effBonus } = explicit
      ? { effPaid: explicit.paid, effBonus: explicit.bonus }
      : polkiSplitTotal(r, totalParsed);
    const defer = polkiUsesAutoBonus ? false : Boolean(polkiBonusToBalance[pk]);
    const pq = effPaid;

    let bq = defer ? 0 : effBonus;
    let cash = 0;
    if (polkiUsesAutoBonus) {
      const autoB = Math.max(0, Math.floor(effBonus));
      const cashUnitsRaw = polkiBonusCashQty[pk];
      const goodsUnitsRaw = polkiBonusGoodsQty[pk];
      const cashUnits =
        cashUnitsRaw != null ? Math.min(Math.max(0, Math.floor(cashUnitsRaw)), autoB) : 0;
      const goodsUnits =
        goodsUnitsRaw != null
          ? Math.min(Math.max(0, Math.floor(goodsUnitsRaw)), autoB - cashUnits)
          : Math.max(0, autoB - cashUnits);
      bq = goodsUnits;
      const unit = r.unit_price_bonus > 0 ? r.unit_price_bonus : r.unit_price_paid;
      cash = cashUnits > 0 && unit > 0 ? cashUnits * unit : 0;
    } else {
      const raw = Number.parseFloat(String(polkiBonusCash[pk] ?? "").replace(/\s/g, "").replace(",", "."));
      cash = Number.isFinite(raw) && raw > 0 ? raw : 0;
      const maxCash =
        r.max_bonus > 0
          ? defer
            ? r.max_bonus * r.unit_price_bonus
            : Math.max(0, (r.max_bonus - bq) * r.unit_price_bonus)
          : 0;
      if (r.max_bonus <= 0) cash = 0;
      else cash = Math.min(cash, maxCash);
    }

    if (pq + bq + cash <= 0) continue;

    const peresortRaw =
      isPolkiByOrder && polkiBonusCalcMode === "manual"
        ? polkiPeresortByPairKey[pk]
        : polkiUsesAutoBonus
          ? polkiAutoBonusPeresortByPairKey[pk]
          : polkiPeresortByPairKey[pk];
    const bonusProductId =
      peresortRaw && peresortRaw !== r.product_id && bq > 0 ? peresortRaw : r.product_id;
    const splitBonusSku = bq > 0 && bonusProductId !== r.product_id;
    const rowReturnQty =
      Number.isFinite(totalParsed) && totalParsed > 0 ? totalParsed : undefined;

    if (usePeriodBatch) {
      const oid = r.order_id;
      if (!oid || oid < 1) {
        missingOrderId = true;
        continue;
      }
      if (!splitBonusSku) {
        batchLines.push({
          order_id: oid,
          product_id: r.product_id,
          paid_qty: pq,
          bonus_qty: bq,
          bonus_cash: cash,
          ...(polkiUsesAutoBonus && rowReturnQty != null ? { return_qty: rowReturnQty } : {})
        });
      } else {
        if (pq > 0) {
          batchLines.push({
            order_id: oid,
            product_id: r.product_id,
            paid_qty: pq,
            bonus_qty: 0,
            bonus_cash: 0,
            ...(polkiUsesAutoBonus && rowReturnQty != null ? { return_qty: rowReturnQty } : {})
          });
        } else if (polkiUsesAutoBonus && rowReturnQty != null) {
          batchLines.push({
            order_id: oid,
            product_id: bonusProductId,
            paid_qty: 0,
            bonus_qty: bq,
            bonus_cash: 0,
            return_qty: rowReturnQty
          });
          continue;
        }
        batchLines.push({
          order_id: oid,
          product_id: bonusProductId,
          paid_qty: 0,
          bonus_qty: bq,
          bonus_cash: 0
        });
        if (cash > 0) {
          batchLines.push({
            order_id: oid,
            product_id: r.product_id,
            paid_qty: 0,
            bonus_qty: 0,
            bonus_cash: cash
          });
        }
      }
    } else {
      if (pq > 0) {
        const cur = periodMerge.get(r.product_id) ?? { paid: 0, bonus: 0, cash: 0 };
        cur.paid += pq;
        periodMerge.set(r.product_id, cur);
      }
      if (bq > 0) {
        const cur = periodMerge.get(bonusProductId) ?? { paid: 0, bonus: 0, cash: 0 };
        cur.bonus += bq;
        periodMerge.set(bonusProductId, cur);
      }
      if (cash > 0) {
        const cur = periodMerge.get(r.product_id) ?? { paid: 0, bonus: 0, cash: 0 };
        cur.cash += cash;
        periodMerge.set(r.product_id, cur);
      }
    }
  }

  return { usePeriodBatch, batchLines, periodMerge, returnQtyByProduct, missingOrderId };
}

/** Submit oldidan auto-bonus qatorlari max dan oshmasin. */
export function isPolkiAutoBonusOverMax(input: {
  rows: PolkiPairRowModel[];
  polkiTotalQty: Record<string, string>;
  explicitByPairKey: Record<string, { paid: number; bonus: number }>;
}): boolean {
  for (const r of input.rows) {
    const pk = r.pair_key;
    const t = parsePolkiQty(input.polkiTotalQty[pk] ?? "");
    if (t > maxReturnQty(r)) return true;
    const ex = input.explicitByPairKey[pk];
    if (!ex) continue;
    if (ex.paid > r.max_paid + 1e-9 || ex.bonus > r.max_bonus + 1e-9) return true;
    if (ex.paid + ex.bonus > maxReturnQty(r) + 1e-9) return true;
  }
  return false;
}

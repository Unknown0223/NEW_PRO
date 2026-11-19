/** OrderCreateDraft pure helpers (ADR-008 M1.4). */
import type { ProductRow } from "@/lib/product-types";
import {
  buildExchangeCreateBody,
  type ExchangePairRow
} from "@/components/orders/exchange-order-create-panel";
import { countPositiveQtyEntries } from "../order-edit-header";
import { availableOrderQty, parsePriceAmount, unitPriceForType } from "../utils";

export type StockRow = { product_id: number; qty: string; reserved_qty: string };

export function stockMapFromRows(
  rows: StockRow[] | undefined
): Map<number, { qty: string; reserved_qty: string }> {
  return new Map((rows ?? []).map((s) => [s.product_id, s]));
}

export function effectiveAvailableQty(args: {
  stock: { qty: string; reserved_qty: string } | undefined;
  sameWarehouseAsEdit: boolean;
  editReservedQty: number;
}): number {
  let avail = availableOrderQty(args.stock);
  if (args.sameWarehouseAsEdit) avail += args.editReservedQty;
  return avail;
}

export type OrdinaryItemsResult =
  | { ok: true; items: { product_id: number; qty: number }[] }
  | { ok: false; reason: "qty" | "qty_over_stock" | "nolines" };

/** Build ordinary/edit line items with stock caps (submit path). */
export function buildOrdinaryItems(args: {
  qtyByProductId: Record<number, string>;
  stockRows: StockRow[] | undefined;
  sameWarehouseAsEdit: boolean;
  editReservedQtyByProduct: Record<number, number>;
}): OrdinaryItemsResult {
  const stockMap = stockMapFromRows(args.stockRows);
  const qtyAgg = new Map<number, number>();
  for (const [idStr, raw] of Object.entries(args.qtyByProductId)) {
    if (!raw || !raw.trim()) continue;
    const productId = Number.parseInt(idStr, 10);
    if (!Number.isFinite(productId) || productId < 1) continue;
    const q = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(q) || q < 0) return { ok: false, reason: "qty" };
    if (q === 0) continue;
    qtyAgg.set(productId, (qtyAgg.get(productId) ?? 0) + q);
  }
  const items: { product_id: number; qty: number }[] = [];
  for (const [productId, totalQ] of Array.from(qtyAgg.entries())) {
    if (totalQ <= 0) continue;
    if (!Number.isFinite(totalQ)) return { ok: false, reason: "qty" };
    const avail = effectiveAvailableQty({
      stock: stockMap.get(productId),
      sameWarehouseAsEdit: args.sameWarehouseAsEdit,
      editReservedQty: args.editReservedQtyByProduct[productId] ?? 0
    });
    if (totalQ > avail + 1e-9) return { ok: false, reason: "qty_over_stock" };
    items.push({ product_id: productId, qty: totalQ });
  }
  if (items.length === 0) return { ok: false, reason: "nolines" };
  return { ok: true, items };
}

export function computeHasQtyOverStock(args: {
  catalogProducts: ProductRow[];
  qtyByProductId: Record<number, string>;
  stockRows: StockRow[] | undefined;
  sameWarehouseAsEdit: boolean;
  editReservedQtyByProduct: Record<number, number>;
}): boolean {
  const map = stockMapFromRows(args.stockRows);
  for (const p of args.catalogProducts) {
    const raw = args.qtyByProductId[p.id];
    if (!raw?.trim()) continue;
    const lineQ = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(lineQ) || lineQ <= 0) continue;
    const avail = effectiveAvailableQty({
      stock: map.get(p.id),
      sameWarehouseAsEdit: args.sameWarehouseAsEdit,
      editReservedQty: args.editReservedQtyByProduct[p.id] ?? 0
    });
    if (lineQ > avail + 1e-9) return true;
  }
  return false;
}

export function computeHasMissingPriceForSelected(args: {
  catalogProducts: ProductRow[];
  qtyByProductId: Record<number, string>;
  priceType: string;
  oldPriceByProductId?: Record<number, string> | null;
}): boolean {
  for (const p of args.catalogProducts) {
    const raw = args.qtyByProductId[p.id];
    const q = Number.parseFloat((raw ?? "").replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) continue;
    if (unitPriceForType(p, args.priceType, args.oldPriceByProductId) == null) return true;
  }
  return false;
}

export function computeMissingPriceProductNames(args: {
  catalogProducts: ProductRow[];
  qtyByProductId: Record<number, string>;
  priceType: string;
  oldPriceByProductId?: Record<number, string> | null;
  limit?: number;
}): string[] {
  const names: string[] = [];
  for (const p of args.catalogProducts) {
    const raw = args.qtyByProductId[p.id];
    const q = Number.parseFloat((raw ?? "").replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) continue;
    if (unitPriceForType(p, args.priceType, args.oldPriceByProductId) == null) {
      names.push(p.name);
    }
  }
  return names.slice(0, args.limit ?? 3);
}

export function computeSelectedItemsCount(args: {
  catalogProducts: ProductRow[];
  qtyByProductId: Record<number, string>;
  isEditMode: boolean;
}): number {
  const fromCatalog = args.catalogProducts.reduce((acc, p) => {
    const raw = args.qtyByProductId[p.id];
    const q = Number.parseFloat((raw ?? "").replace(",", "."));
    return Number.isFinite(q) && q > 0 ? acc + 1 : acc;
  }, 0);
  if (fromCatalog > 0) return fromCatalog;
  if (args.isEditMode) return countPositiveQtyEntries(args.qtyByProductId);
  return 0;
}

export function computeSelectedTotalQty(args: {
  catalogProducts: ProductRow[];
  qtyByProductId: Record<number, string>;
  stockRows: StockRow[] | undefined;
}): string {
  const map = stockMapFromRows(args.stockRows);
  let sum = 0;
  for (const p of args.catalogProducts) {
    const raw = args.qtyByProductId[p.id];
    const q = Number.parseFloat((raw ?? "").replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) continue;
    const avail = availableOrderQty(map.get(p.id));
    sum += Math.min(q, avail);
  }
  return sum.toFixed(3).replace(/\.?0+$/, "");
}

export function computeEstimatedSum(args: {
  catalogProducts: ProductRow[];
  qtyByProductId: Record<number, string>;
  stockRows: StockRow[] | undefined;
  priceType: string;
  oldPriceByProductId?: Record<number, string> | null;
}): number {
  const map = stockMapFromRows(args.stockRows);
  let t = 0;
  for (const p of args.catalogProducts) {
    const raw = args.qtyByProductId[p.id];
    const q = Number.parseFloat((raw ?? "").replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) continue;
    const avail = availableOrderQty(map.get(p.id));
    const effective = Math.min(q, avail);
    if (effective <= 0) continue;
    const up = unitPriceForType(p, args.priceType, args.oldPriceByProductId);
    if (up != null) t += effective * parsePriceAmount(up);
  }
  return t;
}

export function computeTotalVolumeM3(args: {
  catalogProducts: ProductRow[];
  qtyByProductId: Record<number, string>;
  stockRows: StockRow[] | undefined;
}): number {
  const map = stockMapFromRows(args.stockRows);
  let v = 0;
  for (const p of args.catalogProducts) {
    const raw = args.qtyByProductId[p.id];
    const q = Number.parseFloat((raw ?? "").replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) continue;
    const avail = availableOrderQty(map.get(p.id));
    const eff = Math.min(q, avail);
    if (eff <= 0) continue;
    const volU = p.volume_m3 != null ? Number.parseFloat(p.volume_m3) : NaN;
    if (Number.isFinite(volU)) v += eff * volU;
  }
  return v;
}

export function buildExchangeSubmitBody(args: {
  sourceOrderIds: number[];
  minusKey: string;
  minusQty: string;
  plusProductId: string;
  plusQty: string;
  pairRows: ExchangePairRow[];
}) {
  return buildExchangeCreateBody(args);
}

export type CanSubmitOrdinaryBaseArgs = {
  hasClient: boolean;
  hasWarehouse: boolean;
  selectedItemsCount: number;
  mutationPending: boolean;
  loadingLists: boolean;
  editFormBlocked: boolean;
  stockReadyForLines: boolean;
  hasQtyOverStock: boolean;
  hasMissingPriceForSelected: boolean;
  requiresAgentAndPayment: boolean;
  hasAgent: boolean;
  requiresPaymentMethodForSubmit: boolean;
  hasPaymentMethod: boolean;
};

export function canSubmitOrdinaryBase(a: CanSubmitOrdinaryBaseArgs): boolean {
  return Boolean(
    a.hasClient &&
      a.hasWarehouse &&
      a.selectedItemsCount > 0 &&
      !a.mutationPending &&
      !a.loadingLists &&
      !a.editFormBlocked &&
      a.stockReadyForLines &&
      !a.hasQtyOverStock &&
      !a.hasMissingPriceForSelected &&
      (!a.requiresAgentAndPayment || a.hasAgent) &&
      (!a.requiresPaymentMethodForSubmit || a.hasPaymentMethod)
  );
}

export type CanSubmitExchangeBaseArgs = {
  hasClient: boolean;
  hasWarehouse: boolean;
  hasAgent: boolean;
  exchangeReturnsSuccess: boolean;
  exchangePayloadOk: boolean;
  mutationPending: boolean;
  loadingLists: boolean;
};

export function canSubmitExchangeBase(a: CanSubmitExchangeBaseArgs): boolean {
  return Boolean(
    a.hasClient &&
      a.hasWarehouse &&
      a.hasAgent &&
      a.exchangeReturnsSuccess &&
      a.exchangePayloadOk &&
      !a.mutationPending &&
      !a.loadingLists
  );
}

export function filterCatalogProducts(args: {
  products: ProductRow[];
  categoryFilterActive: boolean;
  categoryFilterSet: Set<number>;
  warehouseId: string;
  stockRows: StockRow[] | undefined;
  editReservedQtyByProduct: Record<number, number>;
  qtyByProductId: Record<number, string>;
}): ProductRow[] {
  const stockMap = stockMapFromRows(args.stockRows);
  const filtered = args.products.filter((p) => {
    if (args.categoryFilterActive) {
      const cid = p.category_id;
      if (cid == null || !Number.isFinite(cid) || !args.categoryFilterSet.has(cid)) {
        return false;
      }
    }
    if (!args.warehouseId) return false;
    const s = stockMap.get(p.id);
    if (availableOrderQty(s) > 0) return true;
    const reserved = args.editReservedQtyByProduct[p.id] ?? 0;
    const raw = args.qtyByProductId[p.id];
    const lineQ = Number.parseFloat(String(raw ?? "").replace(",", "."));
    return reserved > 0 || (Number.isFinite(lineQ) && lineQ > 0);
  });
  const seen = new Set<number>();
  const deduped: ProductRow[] = [];
  for (const p of filtered) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
  }
  return deduped;
}

export function computeCategoryIdsWithPositiveStock(args: {
  products: ProductRow[];
  warehouseId: string;
  stockProductIdsKey: string;
  stockReady: boolean;
  stockRows: StockRow[] | undefined;
  editReservedQtyByProduct: Record<number, number>;
  qtyByProductId: Record<number, string>;
}): Set<number> | null {
  if (!args.warehouseId.trim()) return null;
  if (!args.stockProductIdsKey) return new Set<number>();
  if (!args.stockReady) return null;
  const stockMap = stockMapFromRows(args.stockRows);
  const ids = new Set<number>();
  for (const p of args.products) {
    const cid = p.category_id;
    if (cid == null || !Number.isFinite(cid)) continue;
    if (availableOrderQty(stockMap.get(p.id)) > 0) {
      ids.add(cid);
      continue;
    }
    const reserved = args.editReservedQtyByProduct[p.id] ?? 0;
    const lineQ = Number.parseFloat(String(args.qtyByProductId[p.id] ?? "").replace(",", "."));
    if (reserved > 0 || (Number.isFinite(lineQ) && lineQ > 0)) ids.add(cid);
  }
  return ids;
}

export function computeLineProblemCountByCategoryId(args: {
  products: ProductRow[];
  warehouseId: string;
  stockRows: StockRow[] | undefined;
  qtyByProductId: Record<number, string>;
  priceType: string;
  oldPriceByProductId?: Record<number, string> | null;
}): Map<number, number> {
  const counts = new Map<number, number>();
  if (!args.warehouseId.trim()) return counts;
  const stockMap = stockMapFromRows(args.stockRows);
  for (const p of args.products) {
    const cid = p.category_id;
    if (cid == null || !Number.isFinite(cid)) continue;
    if (availableOrderQty(stockMap.get(p.id)) <= 0) continue;
    const raw = args.qtyByProductId[p.id];
    const lineQ = Number.parseFloat((raw ?? "").replace(",", "."));
    if (!Number.isFinite(lineQ) || lineQ <= 0) continue;
    const avail = availableOrderQty(stockMap.get(p.id));
    const missingPrice = unitPriceForType(p, args.priceType, args.oldPriceByProductId) == null;
    const overQty = lineQ > avail;
    if (missingPrice || overQty) counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }
  return counts;
}

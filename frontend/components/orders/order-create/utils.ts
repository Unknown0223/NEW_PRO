/** Order create workspace — pure utility functions. */
import type { ProductRow } from "@/lib/product-types";
import type { PolkiClientItem, PolkiPairRowModel, PolkiOrderPickRow } from "./types";
import { ORDER_STATUS_LABEL_RU } from "./constants";

export function parsePriceAmount(s: string): number {
  const n = Number.parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function parseStockQty(qtyStr: string | undefined): number {
  const n = Number.parseFloat(String(qtyStr ?? "0").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function availableOrderQty(stock: { qty: string; reserved_qty: string } | undefined): number {
  const total = parseStockQty(stock?.qty);
  const reserved = parseStockQty(stock?.reserved_qty);
  return Math.max(0, total - reserved);
}

export function formatQtyState(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const r = Math.round(n * 1000) / 1000;
  const s = String(r);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Polki / возврат с полки: физические шт — только целые числа. */
export function polkiPieceQtyFromNumber(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n + 1e-9);
}

export function formatPolkiPieceQty(n: number): string {
  const q = polkiPieceQtyFromNumber(n);
  return q > 0 ? String(q) : "";
}

export function orderStatusLabelRu(status: string): string {
  const k = status.trim().toLowerCase();
  return ORDER_STATUS_LABEL_RU[k] ?? status;
}

export function currentMonthEndIsoDate(): string {
  const now = new Date();
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const y = eom.getFullYear();
  const m = String(eom.getMonth() + 1).padStart(2, "0");
  const d = String(eom.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function unitPriceForType(p: ProductRow, priceTypeKey: string): string | null {
  const list = p.prices ?? [];
  if (list.length === 0) return null;
  const want = priceTypeKey.trim().toLowerCase();
  const exact = list.find((x) => x.price_type.trim().toLowerCase() === want);
  return exact?.price ?? null;
}

export function isPolkiShelfSourceOrder(o: PolkiOrderPickRow): boolean {
  if (o.status === "cancelled") return false;
  const t = (o.order_type ?? "order").trim();
  return t === "order";
}

export function isPolkiReturnByOrderPickable(o: PolkiOrderPickRow): boolean {
  if (!isPolkiShelfSourceOrder(o)) return false;
  return o.status.trim().toLowerCase() === "delivered";
}

export function polkiOrderRowHasBonus(o: PolkiOrderPickRow): boolean {
  const bq = parseStockQty(o.bonus_qty);
  if (bq > 0) return true;
  return parsePriceAmount(o.bonus_sum ?? "0") > 0;
}

export function buildPolkiPairRows(
  items: PolkiClientItem[],
  products: ProductRow[],
  opts?: { aggregateByProduct?: boolean }
): PolkiPairRowModel[] {
  const aggregateByProduct = opts?.aggregateByProduct === true;
  const pmap = new Map(products.map((p) => [p.id, p]));
  type Acc = {
    order_id: number;
    order_number: string;
    product_id: number;
    name: string;
    sku: string;
    unit: string;
    max_paid: number;
    max_bonus: number;
    unit_price_paid: number;
    unit_price_bonus: number;
    category_id: number | null;
  };
  const groups = new Map<string, Acc>();

  for (const it of items) {
    const qRaw = Number.parseFloat(String(it.qty).replace(/\s/g, "").replace(",", "."));
    const q = polkiPieceQtyFromNumber(qRaw);
    if (q <= 0) continue;
    const oid = it.order_id ?? 0;
    if (!aggregateByProduct && !(oid > 0)) continue;
    const price = Number.parseFloat(String(it.price).replace(/\s/g, "").replace(",", "."));
    const up = Number.isFinite(price) ? price : 0;
    const key = aggregateByProduct ? String(it.product_id) : `${oid}-${it.product_id}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        order_id: aggregateByProduct ? 0 : oid,
        order_number: aggregateByProduct ? "" : (it.order_number ?? `#${oid}`),
        product_id: it.product_id,
        name: it.name,
        sku: it.sku,
        unit: it.unit,
        max_paid: 0,
        max_bonus: 0,
        unit_price_paid: up,
        unit_price_bonus: up,
        category_id: it.category_id ?? null
      };
      groups.set(key, g);
    }
    if (g.category_id == null && it.category_id != null) {
      g.category_id = it.category_id;
    }
    if (it.is_bonus) {
      g.max_bonus += q;
      g.unit_price_bonus = up;
    } else {
      g.max_paid += q;
      g.unit_price_paid = up;
    }
  }

  return Array.from(groups.values())
    .map((g) => {
      const p = pmap.get(g.product_id);
      return {
        pair_key: aggregateByProduct ? `0-${g.product_id}` : `${g.order_id}-${g.product_id}`,
        order_id: g.order_id,
        order_number: g.order_number,
        product_id: g.product_id,
        name: g.name,
        sku: g.sku,
        unit: g.unit,
        max_paid: polkiPieceQtyFromNumber(g.max_paid),
        max_bonus: polkiPieceQtyFromNumber(g.max_bonus),
        unit_price_paid: g.unit_price_paid,
        unit_price_bonus: g.unit_price_bonus,
        category_id: g.category_id ?? p?.category_id ?? null,
        volume_m3: p?.volume_m3
      };
    })
    .sort((a, b) => (a.order_id - b.order_id || a.product_id - b.product_id));
}

export function polkiRowMaxReturnQty(
  r: Pick<PolkiPairRowModel, "max_paid" | "max_bonus">
): number {
  return Math.max(0, r.max_paid + r.max_bonus);
}

/** Qaytarish miqdori zakaz qoldig‘idan oshmasin. */
export function capPolkiQtyToRow(
  r: Pick<PolkiPairRowModel, "max_paid" | "max_bonus">,
  qty: number
): number {
  const q = polkiPieceQtyFromNumber(qty);
  if (q <= 0) return 0;
  return Math.min(q, polkiRowMaxReturnQty(r));
}

export function polkiProductMaxReturnPool(
  rows: PolkiPairRowModel[],
  productId: number
): number {
  let s = 0;
  for (const r of rows) {
    if (r.product_id === productId) s += polkiRowMaxReturnQty(r);
  }
  return s;
}

export function polkiSplitTotal(
  r: PolkiPairRowModel,
  totalIn: number
): { effPaid: number; effBonus: number } {
  const t = capPolkiQtyToRow(r, totalIn);
  const effPaid = Math.min(t, r.max_paid);
  const effBonus = Math.min(Math.max(0, t - effPaid), r.max_bonus);
  return { effPaid, effBonus };
}

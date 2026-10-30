/**
 * Dastavchik qisman qaytarishi: to‘liq qatorlar — zakaz holati `returned`,
 * qisman miqdor — haqiqiy vozvrat hujjati (butun zakaz qarzi yopilmaydi).
 */

export type PartialReturnOrderItem = {
  id: number;
  qty: number;
  product_id: number;
  is_bonus: boolean;
};

export type PartialReturnRequest = {
  order_item_id: number;
  qty: number;
};

export function isFullOrderItemReturn(
  orderItems: PartialReturnOrderItem[],
  requested: PartialReturnRequest[]
): boolean {
  if (orderItems.length === 0 || requested.length === 0) return false;
  const byId = new Map<number, number>();
  for (const row of requested) {
    byId.set(row.order_item_id, (byId.get(row.order_item_id) ?? 0) + row.qty);
  }
  if (byId.size !== orderItems.length) return false;
  for (const line of orderItems) {
    const qty = byId.get(line.id);
    if (qty == null || Math.abs(qty - line.qty) > 1e-6) return false;
  }
  return true;
}

export function partialItemsToReturnLines(
  orderItems: PartialReturnOrderItem[],
  requested: PartialReturnRequest[]
): Array<{ product_id: number; paid_qty: number; bonus_qty: number }> {
  const byId = new Map(orderItems.map((line) => [line.id, line]));
  const merged = new Map<number, { paid_qty: number; bonus_qty: number }>();
  for (const row of requested) {
    const line = byId.get(row.order_item_id);
    if (!line || row.qty <= 0) continue;
    const cur = merged.get(line.product_id) ?? { paid_qty: 0, bonus_qty: 0 };
    if (line.is_bonus) cur.bonus_qty += row.qty;
    else cur.paid_qty += row.qty;
    merged.set(line.product_id, cur);
  }
  return Array.from(merged.entries())
    .filter(([, v]) => v.paid_qty > 0 || v.bonus_qty > 0)
    .map(([product_id, v]) => ({ product_id, ...v }));
}

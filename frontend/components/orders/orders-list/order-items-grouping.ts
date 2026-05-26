import type { OrderItemRow } from "@/components/orders/order-detail-view";

export function parseOrderItemNum(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  return Number.parseFloat(String(s).replace(/\s/g, "").replace(",", ".")) || 0;
}

export function blockFromQty(qty: number): number {
  if (qty <= 0) return 0;
  return Math.ceil(qty / 4);
}

export type CategoryGroup = {
  key: string;
  categoryId: number | null;
  name: string;
  items: OrderItemRow[];
};

export function sortOrderThenBonus(items: OrderItemRow[]): OrderItemRow[] {
  const paid = items.filter((i) => !i.is_bonus).sort((a, b) => a.product_id - b.product_id);
  const bonus = items.filter((i) => i.is_bonus).sort((a, b) => a.product_id - b.product_id);
  return [...paid, ...bonus];
}

export function groupItemsByCategory(items: OrderItemRow[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();
  for (const item of items) {
    const name = item.category_name?.trim() || "Прочее";
    const categoryId = item.category_id ?? null;
    const key = categoryId != null ? `c-${categoryId}` : `n-${name}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, { key, categoryId, name, items: [item] });
    }
  }
  return [...map.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((g) => ({ ...g, items: sortOrderThenBonus(g.items) }));
}

export function lineTypeLabel(p: OrderItemRow): "Заказ" | "Бонус" {
  return p.is_bonus ? "Бонус" : "Заказ";
}

export function computeItemTotals(items: OrderItemRow[]) {
  return items.reduce(
    (acc, p) => {
      const qty = parseOrderItemNum(p.qty);
      const vol = parseOrderItemNum(p.line_volume_m3 ?? p.volume_m3);
      if (p.is_bonus) {
        acc.bonusQty += qty;
        return acc;
      }
      acc.qty += qty;
      acc.blocks += blockFromQty(qty);
      acc.volume += vol;
      acc.sum += parseOrderItemNum(p.total);
      return acc;
    },
    { qty: 0, blocks: 0, volume: 0, sum: 0, bonusQty: 0 }
  );
}

function aggregateKey(item: OrderItemRow): string {
  return `${item.product_id}:${item.is_bonus ? "b" : "p"}`;
}

/** Tanlangan zakazlar qatorlarini mahsulot + bonus bo‘yicha yig‘adi. */
export function aggregateItemsAcrossOrders(allItems: OrderItemRow[]): OrderItemRow[] {
  const map = new Map<string, OrderItemRow>();

  for (const line of allItems) {
    const key = aggregateKey(line);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        ...line,
        id: line.product_id * (line.is_bonus ? -1 : 1)
      });
      continue;
    }
    const qty = parseOrderItemNum(prev.qty) + parseOrderItemNum(line.qty);
    const vol =
      parseOrderItemNum(prev.line_volume_m3 ?? prev.volume_m3) +
      parseOrderItemNum(line.line_volume_m3 ?? line.volume_m3);
    const total = parseOrderItemNum(prev.total) + parseOrderItemNum(line.total);
    map.set(key, {
      ...prev,
      qty: String(qty),
      line_volume_m3: vol > 0 ? String(vol) : prev.line_volume_m3,
      total: String(total),
      price: qty > 0 && !line.is_bonus ? String(total / qty) : prev.price
    });
  }

  return sortOrderThenBonus([...map.values()]);
}

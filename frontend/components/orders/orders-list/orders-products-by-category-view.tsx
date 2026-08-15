"use client";

import type { OrderItemRow } from "@/components/orders/order-detail-view";
import { OrderLineProductsTable } from "@/components/orders/orders-list/order-line-products-table";
import {
  computeItemTotals,
  groupItemsByCategory
} from "@/components/orders/orders-list/order-items-grouping";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

/** Zakaz qatori tagidagi mahsulot bloki — kategoriya tablari + jadval. */
export function OrdersProductsByCategoryView({
  items,
  discount_sum,
  total_sum,
  order_type,
  discount_debt_note
}: {
  items: OrderItemRow[];
  discount_sum?: string | null;
  total_sum?: string | null;
  order_type?: string | null;
  discount_debt_note?: string | null;
}) {
  const groups = useMemo(() => groupItemsByCategory(items), [items]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveKey(null);
      return;
    }
    setActiveKey((prev) => (prev && groups.some((g) => g.key === prev) ? prev : groups[0]!.key));
  }, [groups]);

  const activeGroup = groups.find((g) => g.key === activeKey) ?? groups[0];
  const grandTotals = computeItemTotals(items);

  if (items.length === 0) return null;

  return (
    <>
      {groups.length > 1 ? (
        <div role="tablist" aria-label="Категории товаров" className="mb-3 flex flex-wrap gap-2">
          {groups.map((g) => {
            const active = g.key === activeGroup?.key;
            const t = computeItemTotals(g.items);
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors",
                  active
                    ? "bg-teal-600 text-white shadow-sm dark:bg-teal-700"
                    : "bg-teal-100 text-teal-800 hover:bg-teal-200/80 dark:bg-teal-900/40 dark:text-teal-200"
                )}
                onClick={() => setActiveKey(g.key)}
              >
                {g.name}
                <span className="ml-1.5 opacity-90 tabular-nums">
                  ({formatNumberGrouped(t.sum, { maxFractionDigits: 0 })})
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-3 inline-flex items-center rounded-md bg-teal-100 px-3 py-1.5 text-sm font-medium text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
          {groups[0]?.name ?? "Товары"}
        </div>
      )}
      {activeGroup ? (
        <OrderLineProductsTable
          items={activeGroup.items}
          discount_sum={discount_sum}
          total_sum={total_sum}
          order_type={order_type}
          discount_debt_note={discount_debt_note}
        />
      ) : null}
      {groups.length > 1 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Общий итог по всем категориям:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatNumberGrouped(grandTotals.sum, { maxFractionDigits: 2 })}
          </span>
          {grandTotals.bonusQty > 0 ? (
            <>
              {" "}
              · бонус {formatNumberGrouped(grandTotals.bonusQty, { maxFractionDigits: 3 })} шт.
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

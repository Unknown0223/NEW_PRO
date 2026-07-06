"use client";

import type { OrderItemRow } from "@/components/orders/order-detail-view";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import {
  blockFromQty,
  computeItemTotals,
  displayLineTotal,
  lineTypeLabel,
  parseOrderItemNum
} from "./order-items-grouping";

/** Ichki mahsulot jadvali — expand panel ichida max-w-full (orders-list-expand-layout.ts). */
export function OrderLineProductsTable({
  items,
  discount_sum
}: {
  items: OrderItemRow[];
  discount_sum?: string | null;
}) {
  const totals = computeItemTotals(items);
  const displaySum = items.reduce((acc, p) => acc + (p.is_bonus ? 0 : displayLineTotal(p)), 0);
  const orderDiscount = parseOrderItemNum(discount_sum);
  const footerDiscount =
    orderDiscount > 0 ? orderDiscount : Math.max(0, totals.sum - displaySum);
  const footerTotal = footerDiscount > 0 ? displaySum : totals.sum;

  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full min-w-0 border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Ассортимент</th>
            <th className="w-0 whitespace-nowrap px-2 py-1.5 text-left font-medium text-muted-foreground">
              Тип
            </th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted-foreground">
              Цена
            </th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted-foreground">
              Блок
            </th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted-foreground">
              Кол-во
            </th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted-foreground">
              Объем
            </th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted-foreground">
              Скидка
            </th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted-foreground">
              Общая
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const qty = parseOrderItemNum(p.qty);
            const price = parseOrderItemNum(p.price);
            const vol = parseOrderItemNum(p.line_volume_m3 ?? p.volume_m3);
            const disc = p.is_bonus ? "—" : p.discount_pct?.trim() ? `${p.discount_pct}%` : "0 %";
            const lineTotal = p.is_bonus ? 0 : displayLineTotal(p);
            return (
              <tr
                key={`${p.product_id}-${p.is_bonus ? "b" : "p"}`}
                className={cn(
                  "border-b border-border/50 hover:bg-muted/30",
                  p.is_bonus && "bg-teal-50/70 dark:bg-teal-950/20"
                )}
              >
                <td className="px-2 py-1.5 break-words">{p.name}</td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <span
                    className={cn(
                      "inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold leading-tight",
                      p.is_bonus
                        ? "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {lineTypeLabel(p)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                  {formatNumberGrouped(price, { maxFractionDigits: 2 })}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                  {p.is_bonus ? "—" : blockFromQty(qty)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                  {formatNumberGrouped(qty, { maxFractionDigits: 3 })}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                  {p.is_bonus ? "0" : vol > 0 ? formatNumberGrouped(vol, { maxFractionDigits: 4 }) : "0"}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{disc}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium tabular-nums">
                  {formatNumberGrouped(lineTotal, { maxFractionDigits: 2 })}
                </td>
              </tr>
            );
          })}
          <tr className="bg-muted/40 font-semibold">
            <td className="px-2 py-2">Итого</td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2" />
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{totals.blocks}</td>
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
              {formatNumberGrouped(totals.qty, { maxFractionDigits: 3 })}
              {totals.bonusQty > 0 ? (
                <span className="mt-0.5 block text-[10px] font-normal text-teal-700 dark:text-teal-400">
                  бонус {formatNumberGrouped(totals.bonusQty, { maxFractionDigits: 3 })}
                </span>
              ) : null}
            </td>
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
              {totals.volume > 0 ? formatNumberGrouped(totals.volume, { maxFractionDigits: 4 }) : "0"}
            </td>
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
              {footerDiscount > 0
                ? formatNumberGrouped(footerDiscount, { maxFractionDigits: 2 })
                : null}
            </td>
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-teal-700 dark:text-teal-400">
              {formatNumberGrouped(footerTotal, { maxFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

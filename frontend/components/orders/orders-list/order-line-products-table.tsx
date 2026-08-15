"use client";

import type { OrderItemRow } from "@/components/orders/order-detail-view";
import { formatDiscountPctLabel, orderDiscountPctFromSums } from "@/lib/format-discount-pct";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import {
  blockFromQty,
  computeItemTotals,
  displayLineTotal,
  lineTypeLabel,
  orderLinesFooterPayable,
  parseOrderItemNum
} from "./order-items-grouping";

/** Net qator → skidkadan oldingi (gross) summa. */
function lineGrossFromNet(net: number, pct: number): number {
  if (net <= 0) return 0;
  if (pct <= 0 || pct >= 100) return net;
  return net / (1 - pct / 100);
}

function isShelfReturnType(orderType?: string | null): boolean {
  const ot = (orderType ?? "").trim();
  return ot === "return" || ot === "return_by_order" || ot === "partial_return";
}

/** Ichki mahsulot jadvali — expand panel ichida max-w-full (orders-list-expand-layout.ts). */
export function OrderLineProductsTable({
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
  /** Vozvrat: «Долг скидка» izohi (zakaz/qoida). */
  discount_debt_note?: string | null;
}) {
  const isReturn = isShelfReturnType(order_type);
  const totals = computeItemTotals(items);
  const displaySum = items.reduce((acc, p) => acc + (p.is_bonus ? 0 : displayLineTotal(p)), 0);
  const orderDiscount = parseOrderItemNum(discount_sum);
  const orderNet = parseOrderItemNum(total_sum);
  const footerDiscount =
    orderDiscount > 0 ? orderDiscount : Math.max(0, totals.sum - displaySum);
  const payableNet =
    orderNet > 0
      ? orderNet
      : orderLinesFooterPayable(displaySum, isReturn ? 0 : footerDiscount > 0 ? footerDiscount : 0, null);
  const orderPct = isReturn ? 0 : orderDiscountPctFromSums(total_sum, discount_sum) ?? 0;
  // Oddiy zakaz: Общая = gross. Vozvrat: Общая = refund net; skidka = Долг скидка alohida.
  const footerGross = !isReturn && footerDiscount > 0 ? payableNet + footerDiscount : payableNet;
  const pctLabel = formatDiscountPctLabel(orderPct > 0 ? orderPct : null);
  const debtNote = (discount_debt_note ?? "").trim();

  return (
    <div className="max-w-full space-y-2">
      {isReturn && footerDiscount > 0 ? (
        <div className="rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="font-semibold">
            Долг скидка: {formatNumberGrouped(footerDiscount, { maxFractionDigits: 2 })}
          </div>
          {debtNote ? <div className="mt-0.5 text-[11px] leading-snug opacity-90">{debtNote}</div> : null}
          <div className="mt-0.5 text-[10px] opacity-75">
            После приёмки на складе сумма попадёт в «Балансы клиентов»
          </div>
        </div>
      ) : null}
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
              const priceNet = parseOrderItemNum(p.price);
              const vol = parseOrderItemNum(p.line_volume_m3 ?? p.volume_m3);
              const linePct = parseOrderItemNum(p.discount_pct);
              const effectivePct = isReturn ? 0 : linePct > 0 ? linePct : orderPct;
              const disc = p.is_bonus
                ? "—"
                : isReturn
                  ? "—"
                  : formatDiscountPctLabel(effectivePct > 0 ? effectivePct : null, { empty: "0%" });
              const lineNet = p.is_bonus ? 0 : displayLineTotal(p);
              const showGross = !isReturn && !p.is_bonus && effectivePct > 0 && footerDiscount > 0;
              const lineGross = showGross ? lineGrossFromNet(lineNet, effectivePct) : lineNet;
              const priceShow = showGross ? lineGrossFromNet(priceNet, effectivePct) : priceNet;
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
                    {formatNumberGrouped(priceShow, { maxFractionDigits: 2 })}
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
                    {formatNumberGrouped(lineGross, { maxFractionDigits: 2 })}
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
                {footerDiscount > 0 ? (
                  <span>
                    {formatNumberGrouped(footerDiscount, { maxFractionDigits: 2 })}
                    {isReturn ? (
                      <span className="mt-0.5 block text-[10px] font-normal text-amber-800 dark:text-amber-300">
                        Долг скидка
                      </span>
                    ) : pctLabel ? (
                      <span className="ml-1 text-[10px] font-normal opacity-80">({pctLabel})</span>
                    ) : null}
                  </span>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-teal-700 dark:text-teal-400">
                {formatNumberGrouped(footerGross, { maxFractionDigits: 2 })}
                {!isReturn && footerDiscount > 0 ? (
                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                    к оплате {formatNumberGrouped(payableNet, { maxFractionDigits: 2 })}
                  </span>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

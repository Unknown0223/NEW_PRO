"use client";

import { Button } from "@/components/ui/button";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { Magnet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OrderPaymentStatusBadge } from "./order-payment-status-badge";
import { parseAmountInput, sumExisting } from "./order-payment-utils";
import type { OrderCashInPaymentMethod, PaymentOrderRow } from "./types";

type Props = {
  orders: PaymentOrderRow[];
  paymentMethods: OrderCashInPaymentMethod[];
  onUpdateDraft: (orderId: number, methodId: string, value: number) => void;
  onFillCellFromOrderAmount?: (orderId: number, methodId: string) => void;
  disabled?: boolean;
};

function formatCell(value: number): string {
  return value > 0 ? formatGroupedInteger(value) : "";
}

const TH = "px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap";
const TD = "px-4 py-2.5 align-middle whitespace-nowrap";
/** Input + magnit — barcha to‘lov ustunlarida bir xil */
const PAYMENT_CELL_INNER = "mx-auto flex w-[8.75rem] items-center justify-end gap-1.5";

export function OrderPaymentTable({
  orders,
  paymentMethods,
  onUpdateDraft,
  onFillCellFromOrderAmount,
  disabled
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);

  if (paymentMethods.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        В настройках нет активных способов оплаты. Добавьте их в разделе «Настройки» → «Финансы».
      </p>
    );
  }

  const colSpan = 5 + paymentMethods.length + 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <colgroup>
          <col className="w-[11rem]" />
          <col className="w-[4.5rem]" />
          <col className="w-[7.5rem]" />
          <col className="w-[6.75rem]" />
          <col className="w-[6.75rem]" />
          {paymentMethods.map((m) => (
            <col key={m.id} className="w-[9.25rem]" />
          ))}
          <col className="w-[6.25rem]" />
        </colgroup>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className={cn(TH, "text-left")}>Названия</th>
            <th className={cn(TH, "text-left")}>Заказ ID</th>
            <th className={cn(TH, "text-left")}>Статус заказа</th>
            <th className={cn(TH, "text-right")}>Сумма заказа</th>
            <th className={cn(TH, "text-right")}>Остаток долга</th>
            {paymentMethods.map((m) => (
              <th
                key={m.id}
                className={cn(TH, "text-center")}
                title={`${m.name}${m.currency_code ? ` · ${m.currency_code}` : ""}`}
              >
                <span
                  className={cn(
                    "inline-flex max-w-full items-center justify-center gap-1.5 truncate",
                    m.color && "gap-1.5"
                  )}
                >
                  {m.color ? (
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: m.color }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="truncate">{m.name}</span>
                </span>
              </th>
            ))}
            <th className={cn(TH, "text-right")}>Не оплачено</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {orders.map((order, rowIdx) => (
            <tr
              key={order.id}
              className={cn(
                "transition-colors hover:bg-muted/30",
                order.hasError ? "bg-red-50/50 dark:bg-red-950/20" : "bg-teal-50/30 dark:bg-teal-950/15"
              )}
            >
              <td className={cn(TD, "max-w-[11rem]")}>
                <Link
                  href={`/clients/${order.clientId}`}
                  className="block truncate font-medium text-teal-700 hover:underline dark:text-teal-400"
                  title={order.clientName}
                >
                  {order.clientName}
                </Link>
              </td>
              <td className={TD}>
                <Link
                  href={`/orders/${order.id}`}
                  className="text-foreground hover:text-teal-700 hover:underline dark:hover:text-teal-400"
                >
                  {order.id}
                </Link>
              </td>
              <td className={TD}>
                <OrderPaymentStatusBadge status={order.status} />
              </td>
              <td className={cn(TD, "text-right tabular-nums")}>
                {formatGroupedInteger(order.orderAmount)}
              </td>
              <td className={cn(TD, "text-right tabular-nums")}>
                {formatGroupedInteger(order.debt)}
              </td>
              {paymentMethods.map((m, colIdx) => {
                const existing = order.existingByType[m.payment_type] ?? 0;
                const draft = order.draftByMethodId[m.id] ?? 0;
                return (
                  <td key={m.id} className={TD}>
                    <div className={PAYMENT_CELL_INNER}>
                      <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={disabled}
                          data-testid={
                            colIdx === 0 && rowIdx === 0 ? "new-payment-amount" : undefined
                          }
                          value={formatCell(draft)}
                          onChange={(e) =>
                            onUpdateDraft(order.id, m.id, parseAmountInput(e.target.value))
                          }
                          onFocus={() => setEditingId(order.id)}
                          onBlur={() => setEditingId(null)}
                          className={cn(
                            "h-8 w-full min-w-0 max-w-[6.25rem] rounded-md border px-2 py-1 text-right text-sm tabular-nums outline-none transition-colors",
                            editingId === order.id && colIdx === 0
                              ? "border-teal-500 ring-1 ring-teal-500/40"
                              : "border-input bg-background"
                          )}
                          aria-label={`${m.name}, заказ ${order.id}`}
                        />
                        {existing > 0 ? (
                          <span
                            className="text-[10px] tabular-nums text-muted-foreground"
                            title="Уже оплачено"
                          >
                            +{formatGroupedInteger(existing)}
                          </span>
                        ) : null}
                      </div>
                      {onFillCellFromOrderAmount ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0 border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950/50"
                          disabled={disabled}
                          title="Подставить остаток по заказу в эту ячейку"
                          aria-label={`Подставить сумму заказа ${order.id}, ${m.name}`}
                          onClick={() => onFillCellFromOrderAmount(order.id, m.id)}
                        >
                          <Magnet className="size-3.5" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                );
              })}
              <td
                className={cn(
                  TD,
                  "text-right font-medium tabular-nums",
                  order.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
                )}
              >
                {formatGroupedInteger(order.unpaid)}
              </td>
            </tr>
          ))}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-12 text-center text-muted-foreground">
                Нет заказов для оплаты
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

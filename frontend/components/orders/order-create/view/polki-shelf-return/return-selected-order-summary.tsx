"use client";

import { cn } from "@/lib/utils";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import {
  formatCompositionQty,
  formatCompositionSum,
  summarizePolkiOrderRows
} from "./polki-order-composition";
import { PolkiOrderCompositionDetails } from "./polki-order-composition-details";
import { polkiCard } from "./polki-return-ui";

/** Tanlangan zakaz: sotuv va bonus — scroll paytida tepada qoladi. */
export function ReturnSelectedOrderSummary({
  vm,
  className,
  compact = false
}: {
  vm: OrderCreateVm;
  className?: string;
  compact?: boolean;
}) {
  const { isPolkiByOrder, polkiOrderIds, polkiRowsAll, polkiOrdersForPick } = vm;

  if (!isPolkiByOrder || polkiOrderIds.length !== 1) return null;

  const orderId = polkiOrderIds[0]!;
  const rows = polkiRowsAll.filter((r) => r.order_id === orderId);
  if (rows.length === 0) return null;

  const pick = polkiOrdersForPick.find((o) => o.id === orderId);
  const summary = summarizePolkiOrderRows(rows);
  const orderNumber = rows[0]?.order_number || pick?.number || String(orderId);
  const warehouseName = pick?.warehouse_name?.trim() || null;

  return (
    <div
      className={cn(
        polkiCard,
        "sticky top-0 z-20 border-teal-700/25 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-slate-950/95",
        compact ? "p-3" : "p-4",
        className
      )}
      role="region"
      aria-label={`Состав заказа №${orderNumber}`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Заказ №{orderNumber}
            <span className="ml-2 font-normal text-muted-foreground">· к возврату</span>
          </h2>
          {warehouseName ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">Склад: {warehouseName}</p>
          ) : null}
        </div>
        <div className="text-right text-[10px] tabular-nums text-slate-600">
          <div>
            Оплата:{" "}
            <span className="font-semibold text-slate-800">
              {formatCompositionQty(summary.paidQtyTotal)} шт
            </span>
            {summary.paidSumTotal > 0 ? (
              <span className="ml-1">· {formatCompositionSum(summary.paidSumTotal)} сум</span>
            ) : null}
          </div>
          {summary.bonusQtyTotal > 0 ? (
            <div className="text-amber-800">
              Бонус:{" "}
              <span className="font-semibold">{formatCompositionQty(summary.bonusQtyTotal)} шт</span>
            </div>
          ) : null}
        </div>
      </div>

      <PolkiOrderCompositionDetails
        composition={summary}
        className={
          summary.paidLines.length > 0 && summary.bonusLines.length > 0 ? "sm:grid-cols-2" : undefined
        }
        dense={compact}
      />

      {summary.bonusQtyTotal <= 0 ? (
        <p className="mt-2 text-[10px] text-muted-foreground">Бонусных позиций в заказе нет.</p>
      ) : null}
    </div>
  );
}

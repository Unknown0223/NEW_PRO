"use client";

import { Gift, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCompositionQty,
  formatCompositionSum,
  type PolkiOrderCompositionSummary
} from "./polki-order-composition";

export function PolkiOrderCompositionDetails({
  composition,
  className,
  dense = false
}: {
  composition: PolkiOrderCompositionSummary;
  className?: string;
  dense?: boolean;
}) {
  const text = dense ? "text-[10px]" : "text-[11px]";

  return (
    <div
      className={cn(
        "grid gap-3",
        composition.paidLines.length > 0 && composition.bonusLines.length > 0
          ? "sm:grid-cols-2"
          : "grid-cols-1",
        className
      )}
    >
      {composition.paidLines.length > 0 ? (
        <div>
          <div
            className={cn(
              "mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-600",
              dense ? "text-[9px]" : "text-[10px]"
            )}
          >
            <Package className="h-3.5 w-3.5 text-teal-700" aria-hidden />
            Продажа (оплата)
          </div>
          <ul className="space-y-0.5">
            {composition.paidLines.map((l) => (
              <li
                key={`paid-${l.productId}`}
                className={cn("flex justify-between gap-2 tabular-nums", text)}
              >
                <span className="min-w-0 truncate font-medium text-slate-800">{l.name}</span>
                <span className="shrink-0 text-slate-700">
                  {formatCompositionQty(l.qty)} шт
                  {l.sum > 0 ? (
                    <span className="ml-1 text-muted-foreground">· {formatCompositionSum(l.sum)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {composition.bonusLines.length > 0 ? (
        <div>
          <div
            className={cn(
              "mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-amber-800",
              dense ? "text-[9px]" : "text-[10px]"
            )}
          >
            <Gift className="h-3.5 w-3.5" aria-hidden />
            Бонус
          </div>
          <ul className="space-y-0.5">
            {composition.bonusLines.map((l) => (
              <li
                key={`bonus-${l.productId}`}
                className={cn("flex justify-between gap-2 tabular-nums", text)}
              >
                <span className="min-w-0 truncate font-medium text-slate-800">{l.name}</span>
                <span className="shrink-0 text-amber-900">{formatCompositionQty(l.qty)} шт</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

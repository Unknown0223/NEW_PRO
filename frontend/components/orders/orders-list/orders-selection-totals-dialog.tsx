"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { formatGroupedInteger, formatNumberGrouped } from "@/lib/format-numbers";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

type OrdersSelectionTotalsDialogProps = Pick<
  UseOrdersListPageResult,
  "totalsDialogOpen" | "setTotalsDialogOpen" | "selectionTotals"
>;

export function OrdersSelectionTotalsDialog({
  totalsDialogOpen,
  setTotalsDialogOpen,
  selectionTotals
}: OrdersSelectionTotalsDialogProps) {
  return (
    <Dialog open={totalsDialogOpen} onOpenChange={setTotalsDialogOpen}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Tanlangan zakazlar bo‘yicha itoglar</DialogTitle>
          <DialogDescription>
            Joriy sahifadan tanlangan qatorlar. «Долг» — faqat tanlovda yetkazilgan savdo zakazlari
            ustunidagi qiymatlar yig‘indisi.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-border/60 py-1">
            <dt className="text-muted-foreground">Zakazlar soni</dt>
            <dd className="font-medium tabular-nums">
              {formatGroupedInteger(selectionTotals.count)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border/60 py-1">
            <dt className="text-muted-foreground">Jami miqdor (qty)</dt>
            <dd className="font-medium tabular-nums">
              {formatNumberGrouped(selectionTotals.qty, { maxFractionDigits: 3 })}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border/60 py-1">
            <dt className="text-muted-foreground">Jami summa</dt>
            <dd className="font-medium tabular-nums">
              {formatNumberGrouped(selectionTotals.total, { maxFractionDigits: 2 })}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border/60 py-1">
            <dt className="text-muted-foreground">Jami skidka</dt>
            <dd className="font-medium tabular-nums">
              {formatNumberGrouped(selectionTotals.discount, { maxFractionDigits: 2 })}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border/60 py-1">
            <dt className="text-muted-foreground">Jami bonus (dona)</dt>
            <dd className="font-medium tabular-nums">
              {formatNumberGrouped(selectionTotals.bonusQty, { maxFractionDigits: 3 })}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-muted-foreground">Jami долг (tanlangan)</dt>
            <dd className="font-medium tabular-nums">
              {formatNumberGrouped(selectionTotals.debt, { maxFractionDigits: 2 })}
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}

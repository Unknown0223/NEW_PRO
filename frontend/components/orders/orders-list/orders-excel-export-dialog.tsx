"use client";

import type { OrderListRow } from "@/components/orders/order-detail-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { getUserFacingError } from "@/lib/error-utils";
import {
  downloadOrdersListExcel,
  type OrdersExcelExportMode
} from "@/lib/orders-list-excel-export";
import { FileSpreadsheet, ListTree } from "lucide-react";
import { useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  orders: OrderListRow[];
  visibleColumnOrder: string[];
};

export function OrdersExcelExportDialog({
  open,
  onOpenChange,
  tenantSlug,
  orders,
  visibleColumnOrder
}: Props) {
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runExport = async (mode: OrdersExcelExportMode) => {
    setPending(true);
    setError(null);
    setProgress({ done: 0, total: orders.length });
    try {
      await downloadOrdersListExcel({
        mode,
        tenantSlug,
        orders,
        visibleColumnOrder,
        onProgress: (done, total) => setProgress({ done, total })
      });
      onOpenChange(false);
    } catch (e) {
      setError(getUserFacingError(e, "Excel yuklab bo‘lmadi."));
    } finally {
      setPending(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Экспорт в Excel</DialogTitle>
          <DialogDescription>
            Joriy sahifadagi {orders.length} ta zakaz. Tanlangan formatda yuklab olinadi.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-1">
          <button
            type="button"
            disabled={pending}
            className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
            onClick={() => void runExport("detailed")}
          >
            <ListTree className="mt-0.5 size-5 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-foreground">Детальный</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Zakaz qatori, ostida mahsulotlar (Тип, бонус, miqdor) — jadvaldagi ochilgan ko‘rinish.
              </span>
            </span>
          </button>
          <button
            type="button"
            disabled={pending}
            className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
            onClick={() => void runExport("simple")}
          >
            <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-foreground">Обычный</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Har bir tovar alohida qator: zakaz ustunlari + mahsulot (zakaz va bonus bilan).
              </span>
            </span>
          </button>
        </div>

        {pending && progress ? (
          <p className="text-center text-xs text-muted-foreground">
            Загрузка товаров… {progress.done} / {progress.total}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

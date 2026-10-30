"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { defaultDatetimeLocalValue } from "@/lib/order-status-datetime";
import { orderStatusDatetimeDialogTitle } from "@/lib/order-status-datetime";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending?: boolean;
  /** Pastki panel dropdownidan tanlangan status. */
  status: string;
  onApply: (status: string, occurredAtIso: string) => void;
};

/** Guruh status: pastki paneldan status tanlangach — faqat sana/vaqt tasdig‘i. */
export function OrdersBulkStatusDialog({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  status,
  onApply
}: Props) {
  const [datetimeLocal, setDatetimeLocal] = useState(() => defaultDatetimeLocalValue());

  useEffect(() => {
    if (open) setDatetimeLocal(defaultDatetimeLocalValue());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{status ? orderStatusDatetimeDialogTitle(status, "order") : "Дата и время"}</DialogTitle>
          <DialogDescription>
            {`Укажите дату и время перехода для ${formatGroupedInteger(selectedCount)} заказ(ов).`}
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Дата и время</span>
          <input
            type="datetime-local"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={datetimeLocal}
            onChange={(e) => setDatetimeLocal(e.target.value)}
            disabled={isPending}
          />
        </label>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={isPending || !status || !datetimeLocal}
            onClick={() => onApply(status, new Date(datetimeLocal).toISOString())}
          >
            {isPending ? "Сохранение…" : "Применить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

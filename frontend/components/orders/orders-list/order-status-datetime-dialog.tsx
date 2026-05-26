"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { defaultDatetimeLocalValue } from "@/lib/order-status-datetime";
import { useEffect, useState } from "react";

export type OrderStatusDatetimeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel?: string;
  onConfirm: (datetimeLocal: string) => void;
  isPending?: boolean;
};

/** Kichik modal — tizim `datetime-local` kalendari. */
export function OrderStatusDatetimeDialog({
  open,
  onOpenChange,
  title,
  confirmLabel = "Сохранить",
  onConfirm,
  isPending
}: OrderStatusDatetimeDialogProps) {
  const [value, setValue] = useState(() => defaultDatetimeLocalValue());

  useEffect(() => {
    if (open) setValue(defaultDatetimeLocalValue());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Дата и время</span>
          <input
            type="datetime-local"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isPending}
          />
        </label>
        <DialogFooter className="mt-2 gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-teal-700 text-white hover:bg-teal-800"
            disabled={!value.trim() || isPending}
            onClick={() => onConfirm(value)}
          >
            {isPending ? "Сохранение…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

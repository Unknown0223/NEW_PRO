"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changeCount: number;
  effectiveAt: Date;
  saving?: boolean;
  onConfirm: () => void;
};

export function PriceMatrixSaveDialog({
  open,
  onOpenChange,
  changeCount,
  effectiveAt,
  saving,
  onConfirm
}: Props) {
  const isFuture = effectiveAt.getTime() > Date.now() + 1000;
  const whenLabel = effectiveAt.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Подтверждение сохранения
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {isFuture
            ? `Narxlar reja bo‘yicha ${whenLabel} da qo‘llanadi. Hozirgi narxlar o‘zgarmaydi.`
            : "Narxlar darhol saqlanadi va keyingi operatsiyalarga ta’sir qiladi."}
        </p>
        <dl className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">O‘zgartirilgan pozitsiyalar</dt>
            <dd className="font-semibold tabular-nums">{changeCount}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Установка времени</dt>
            <dd className="font-medium">{whenLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Rejim</dt>
            <dd className="font-medium">{isFuture ? "Rejalashtirilgan" : "Darhol"}</dd>
          </div>
        </dl>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            className="border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            disabled={saving || changeCount === 0}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={onConfirm}
          >
            {saving ? "Сохранение…" : "Сохранить изменения"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

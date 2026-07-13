"use client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { DatePickerPopover, formatRuDateButton } from "@/components/ui/date-picker-popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  eligibleCount: number;
  isPending?: boolean;
  onApply: (payload: { is_consignment: boolean; consignment_due_date: string | null }) => void;
};

export function OrdersBulkConsignmentDialog({
  open,
  onOpenChange,
  selectedCount,
  eligibleCount,
  isPending,
  onApply
}: Props) {
  const [mode, setMode] = useState<"yes" | "no">("yes");
  const [dueDate, setDueDate] = useState("");
  const [dueOpen, setDueOpen] = useState(false);
  const dueAnchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode("yes");
    setDueDate("");
    setDueOpen(false);
  }, [open]);

  const skippedCount = Math.max(0, selectedCount - eligibleCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Изменить консигнацию</DialogTitle>
          <DialogDescription>
            Выбрано {formatGroupedInteger(selectedCount)}. Доступно для изменения:{" "}
            {formatGroupedInteger(eligibleCount)} (статусы «Новый» и «Подтверждён», тип «Заказ»).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {skippedCount > 0 ? (
            <p className="rounded-md border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              {formatGroupedInteger(skippedCount)} заказ(ов) будут пропущены — консигнацию можно
              менять только у «Новый» / «Подтверждён».
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === "yes" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("yes")}
            >
              Консигнация — да
            </Button>
            <Button
              type="button"
              variant={mode === "no" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("no")}
            >
              Консигнация — нет
            </Button>
          </div>
          {mode === "yes" ? (
            <div className="space-y-2">
              <Label>Срок консигнации (необязательно)</Label>
              <button
                ref={dueAnchorRef}
                type="button"
                disabled={isPending}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-10 w-full justify-start gap-2 font-normal",
                  dueOpen && "border-primary/60 bg-primary/5"
                )}
                aria-expanded={dueOpen}
                aria-haspopup="dialog"
                onClick={() => setDueOpen((o) => !o)}
              >
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">
                  {formatRuDateButton(dueDate) || "дд.мм.гггг"}
                </span>
              </button>
              <DatePickerPopover
                open={dueOpen}
                onOpenChange={setDueOpen}
                anchorRef={dueAnchorRef}
                value={dueDate}
                onChange={setDueDate}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={isPending || eligibleCount === 0}
            onClick={() => {
              onApply({
                is_consignment: mode === "yes",
                consignment_due_date:
                  mode === "yes" && dueDate.trim() ? `${dueDate.trim()}T12:00:00.000Z` : null
              });
            }}
          >
            {isPending ? "Сохранение…" : "Применить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

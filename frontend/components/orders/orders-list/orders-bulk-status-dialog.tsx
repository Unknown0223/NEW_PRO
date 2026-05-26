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

const STATUS_MENU = [
  { value: "new", label: "Новый", color: "#0369a1" },
  { value: "confirmed", label: "Подтверждён", color: "#854d0e" },
  { value: "picking", label: "Комплектация", color: "#3730a3" },
  { value: "delivering", label: "Отгружен", color: "#9a3412" },
  { value: "delivered", label: "Доставлен", color: "#166534" },
  { value: "cancelled", label: "Отменён", color: "#4b5563" }
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending?: boolean;
  onApply: (status: string, occurredAtIso: string) => void;
  /** Pastki paneldan status tanlanganda — to‘g‘ridan-to‘g‘ri sana qadamiga */
  initialStatus?: string;
  initialStep?: "status" | "datetime";
};

export function OrdersBulkStatusDialog({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onApply,
  initialStatus = "",
  initialStep = "status"
}: Props) {
  const [step, setStep] = useState<"status" | "datetime">("status");
  const [status, setStatus] = useState("");
  const [datetimeLocal, setDatetimeLocal] = useState(() => defaultDatetimeLocalValue());

  useEffect(() => {
    if (!open) return;
    setStep(initialStep);
    setStatus(initialStatus);
    setDatetimeLocal(defaultDatetimeLocalValue());
  }, [open, initialStatus, initialStep]);

  const title =
    step === "status"
      ? "Изменить статус"
      : status
        ? orderStatusDatetimeDialogTitle(status, "order")
        : "Дата и время";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === "status"
              ? `Выберите новый статус для ${formatGroupedInteger(selectedCount)} заказ(ов).`
              : "Укажите дату и время перехода."}
          </DialogDescription>
        </DialogHeader>

        {step === "status" ? (
          <div className="grid gap-1">
            {STATUS_MENU.map((s) => (
              <button
                key={s.value}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                style={{ color: s.color }}
                onClick={() => {
                  setStatus(s.value);
                  setStep("datetime");
                }}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden
                />
                {s.label}
              </button>
            ))}
          </div>
        ) : (
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
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "datetime" ? (
            <Button type="button" variant="outline" onClick={() => setStep("status")} disabled={isPending}>
              Назад
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
          )}
          {step === "datetime" ? (
            <Button
              type="button"
              disabled={isPending || !status}
              onClick={() => onApply(status, new Date(datetimeLocal).toISOString())}
            >
              {isPending ? "Сохранение…" : "Применить"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

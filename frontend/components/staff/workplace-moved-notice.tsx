"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/** Staff «Конфигурация» — joy yo‘q bo‘lsa. */
export const STAFF_NO_WORK_SLOT_MSG = "Сначала закрепите рабочее место";

type Props = {
  className?: string;
  workSlotId?: number | null;
  /** expeditor — avtoprivyazka / yo‘nalish ham joyda; supervisor — jamoa agentlar */
  variant?: "default" | "expeditor" | "supervisor";
  /** true — konfiguratsiya dialogini ochish uchun ?openConfig=1 */
  openConfig?: boolean;
};

/** Склад, филиал, цены и сотрудник на месте — только в Рабочее место. */
export function WorkplaceMovedNotice({
  className = "",
  workSlotId,
  variant = "default",
  openConfig = false
}: Props) {
  const base = workSlotId != null ? `/work-slots/${workSlotId}` : "/work-slots";
  const href = openConfig && workSlotId != null ? `${base}?openConfig=1` : base;

  if (variant === "expeditor") {
    return (
      <p
        className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
      >
        Склад, филиал, территория, направление и{" "}
        <strong>условия автопривязки заказов</strong> настраиваются в{" "}
        <Link href={href} className="font-semibold underline">
          Рабочее место
        </Link>
        {openConfig && workSlotId != null ? " → «Конфигурация места» → вкладка «Экспедитор»" : ""}.
      </p>
    );
  }

  if (variant === "supervisor") {
    return (
      <p
        className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
      >
        Команда агентов (подчинённые) настраивается в{" "}
        <Link href={href} className="font-semibold underline">
          Рабочее место
        </Link>
        {" → «Конфигурация» → вкладка «Команда»"}.
      </p>
    );
  }

  return (
    <p
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
    >
      Склад, филиал, территория, направление и назначение сотрудника настраиваются в{" "}
      <Link href={href} className="font-semibold underline">
        Рабочее место
      </Link>
      .
    </p>
  );
}

/**
 * Staff qatoridagi «Конфигурация»:
 * - faol slot → `/work-slots/:id?openConfig=1` (+ ixtiyoriy section)
 * - yo‘q → `onMissingSlot` (odatda NeedWorkSlotDialog)
 */
export function goToStaffWorkplaceConfig(
  router: { push: (href: string) => void },
  workSlotId: number | null | undefined,
  onMissingSlot: () => void,
  section?: string
): void {
  if (workSlotId != null && workSlotId > 0) {
    const q = new URLSearchParams({ openConfig: "1" });
    if (section?.trim()) q.set("section", section.trim());
    router.push(`/work-slots/${workSlotId}?${q.toString()}`);
    return;
  }
  onMissingSlot();
}

type NeedSlotProps = {
  open: boolean;
  onClose: () => void;
  message?: string;
};

/** Joy biriktirilmaganda konfiguratsiya o‘rniga. */
export function NeedWorkSlotDialog({
  open,
  onClose,
  message = STAFF_NO_WORK_SLOT_MSG
}: NeedSlotProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Конфигурация</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-700">{message}</p>
        <p className="text-xs text-muted-foreground">
          Сначала закрепите сотрудника за местом на странице «Рабочее место», затем откройте конфигурацию через
          настройки.
        </p>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          <Link
            href="/work-slots"
            className={cn(buttonVariants({ className: "bg-teal-700 hover:bg-teal-800" }))}
            onClick={onClose}
          >
            Рабочее место
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

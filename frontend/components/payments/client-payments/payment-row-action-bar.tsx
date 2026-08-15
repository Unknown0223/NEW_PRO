"use client";

import { Check, History, Pen, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { HistoryDrawer } from "@/components/history/history-drawer";
import { usePermissions } from "@/lib/use-permissions";

type Props = {
  /** Panel ko'rinishi (kamida bitta qator tanlanganida). */
  open: boolean;
  selectedCount: number;
  /** Bitta tanlovda — masalan «Оплата #123 · Клиент». */
  title: string;
  showEdit: boolean;
  showDelete: boolean;
  showBulkConfirm?: boolean;
  bulkConfirmDisabled?: boolean;
  bulkConfirmHint?: string;
  onEdit: () => void;
  onDelete: () => void;
  onBulkConfirm?: () => void;
  onClear: () => void;
  /** Tarix tugmasi faqat bitta tanlovda. */
  historyPaymentId?: number | null;
};

/**
 * «Оплаты клиентов» jadvalida tanlangan qator(lar) uchun pastdagi amallar paneli.
 */
export function PaymentRowActionBar({
  open,
  selectedCount,
  title,
  showEdit,
  showDelete,
  showBulkConfirm = false,
  bulkConfirmDisabled = false,
  bulkConfirmHint,
  onEdit,
  onDelete,
  onBulkConfirm,
  onClear,
  historyPaymentId
}: Props) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { has } = usePermissions();
  const canHistory =
    selectedCount === 1 &&
    historyPaymentId != null &&
    has("cash.oplaty_klientov.history");

  useEffect(() => {
    setMounted(true);
    if (open) {
      setVisible(true);
      return;
    }
    const h = setTimeout(() => setVisible(false), 250);
    return () => clearTimeout(h);
  }, [open]);

  if (!mounted) return null;
  if (!visible && !open) return null;

  const bar = (
    <div
      role="toolbar"
      aria-label="Действия с оплатой"
      className={cn(
        "fixed inset-x-0 bottom-4 z-[200] flex justify-center px-3 transition-all duration-200",
        !open && "pointer-events-none translate-y-24 opacity-0"
      )}
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-emerald-600/40 bg-card px-2 py-2 shadow-[0_8px_40px_rgba(6,59,54,0.28)]">
        <span className="max-w-[280px] truncate rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-slate-700">
          {selectedCount > 1 ? (
            <>
              Выбрано: <span className="text-emerald-700">{selectedCount}</span>
            </>
          ) : (
            title
          )}
        </span>

        {showBulkConfirm && onBulkConfirm ? (
          <button
            type="button"
            onClick={onBulkConfirm}
            disabled={bulkConfirmDisabled}
            title={
              bulkConfirmHint ??
              (bulkConfirmDisabled
                ? "Подтверждение доступно только для оплат «Ожидание подтверждения»"
                : "Подтвердить выбранные оплаты")
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Check className="size-4" />
            Подтвердить
          </button>
        ) : null}

        {showEdit ? (
          <button
            type="button"
            onClick={onEdit}
            title="Редактировать оплату"
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Pen className="size-4" />
            Редактировать
          </button>
        ) : null}

        {showDelete ? (
          <button
            type="button"
            onClick={onDelete}
            title={selectedCount > 1 ? "Удалить выбранные (в архив)" : "Удалить (перенести в архив)"}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            <Trash2 className="size-4" />
            {selectedCount > 1 ? `Удалить (${selectedCount})` : "Удалить"}
          </button>
        ) : null}

        {canHistory ? (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            title="История оплаты"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-muted"
          >
            <History className="size-4" />
            История
          </button>
        ) : null}

        <span className="mx-1 hidden h-6 w-px bg-muted sm:block" />

        <button
          type="button"
          onClick={onClear}
          title="Сбросить выбор"
          className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-muted hover:text-slate-700"
          aria-label="Сбросить выбор"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(bar, document.body)}
      {canHistory && historyPaymentId != null ? (
        <HistoryDrawer
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          entityType="payment"
          entityId={historyPaymentId}
          title={`История · Оплата #${historyPaymentId}`}
        />
      ) : null}
    </>
  );
}

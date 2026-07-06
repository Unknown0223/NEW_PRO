"use client";

import { Trash2 } from "lucide-react";
import { TemplateModal } from "@/components/payments/client-payments/template-modal";

type Props = {
  open: boolean;
  count: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function EprBulkDeleteModal({ open, count, busy = false, onClose, onConfirm }: Props) {
  return (
    <TemplateModal open={open} onClose={onClose} title="Удалить" maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="grid size-10 place-items-center rounded-full bg-red-100 text-red-600">
            <Trash2 className="size-5" />
          </div>
        </div>
        <p className="text-center text-sm font-medium text-slate-700">Вы действительно хотите удалить?</p>
        <p className="text-center text-xs text-slate-500">
          Будет удалено заявок: <span className="font-semibold">{count}</span>
        </p>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm text-slate-700 hover:bg-card disabled:opacity-50"
          >
            Нет
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "…" : "Да"}
          </button>
        </div>
      </div>
    </TemplateModal>
  );
}

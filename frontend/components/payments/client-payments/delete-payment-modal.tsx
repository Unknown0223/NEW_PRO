"use client";

import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { TemplateModal } from "./template-modal";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  paymentId?: number;
  onConfirmed?: () => void;
};

export function DeletePaymentModal({
  open,
  onClose,
  tenantSlug,
  paymentId,
  onConfirmed
}: Props) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setErr(null);
    }
  }, [open]);

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!paymentId) throw new Error("NO_PAYMENT");
      const params = new URLSearchParams();
      if (reason.trim()) params.set("cancel_reason_ref", reason.trim());
      const qs = params.toString();
      await api.delete(`/api/${tenantSlug}/payments/${paymentId}${qs ? `?${qs}` : ""}`);
    },
    onSuccess: () => {
      onConfirmed?.();
      onClose();
    },
    onError: (e: unknown) => {
      setErr(getUserFacingError(e, "Не удалось удалить платёж."));
    }
  });

  return (
    <TemplateModal open={open} onClose={onClose} title="Удалить">
      <div className="space-y-5">
        <div className="flex justify-center">
          <Trash2 className="h-10 w-10 text-red-500" />
        </div>

        <p className="text-center text-sm text-slate-700">Вы действительно хотите удалить?</p>

        <div>
          <textarea
            placeholder="Причина удалении"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-border px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-200"
          />
        </div>

        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleteMut.isPending}
            className="flex-1 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-muted"
          >
            Нет
          </button>
          <button
            type="button"
            onClick={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
            className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60"
          >
            {deleteMut.isPending ? "Удаление…" : "Да"}
          </button>
        </div>
      </div>
    </TemplateModal>
  );
}

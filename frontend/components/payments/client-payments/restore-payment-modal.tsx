"use client";

import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { useMutation } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { TemplateModal } from "./template-modal";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  paymentId?: number;
  onConfirmed?: () => void;
};

export function RestorePaymentModal({
  open,
  onClose,
  tenantSlug,
  paymentId,
  onConfirmed
}: Props) {
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setComment("");
      setErr(null);
    }
  }, [open]);

  const restoreMut = useMutation({
    mutationFn: async () => {
      if (!paymentId) throw new Error("NO_PAYMENT");
      const text = comment.trim();
      if (!text) throw new Error("NO_COMMENT");
      await api.post(`/api/${tenantSlug}/payments/${paymentId}/restore`, {
        comment: text
      });
    },
    onSuccess: () => {
      onConfirmed?.();
      onClose();
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === "NO_COMMENT") {
        setErr("Укажите комментарий восстановления.");
        return;
      }
      setErr(getUserFacingError(e, "Не удалось восстановить платёж."));
    }
  });

  const commentOk = comment.trim().length > 0;

  return (
    <TemplateModal open={open} onClose={onClose} title="Восстановить платёж">
      <div className="space-y-5">
        <div className="flex justify-center">
          <RotateCcw className="h-10 w-10 text-emerald-600" />
        </div>

        <p className="text-center text-sm text-slate-700">
          {paymentId ? (
            <>
              Восстановить платёж <span className="font-semibold">#{paymentId}</span>? Сумма снова учтётся на
              балансе; запись вернётся в прежнее состояние.
            </>
          ) : (
            "Восстановить платёж? Сумма снова учтётся на балансе."
          )}
        </p>

        <div>
          <label htmlFor="restore-comment" className="mb-1.5 block text-xs font-medium text-slate-600">
            Комментарий восстановления <span className="text-red-500">*</span>
          </label>
          <textarea
            id="restore-comment"
            placeholder="Причина или примечание к восстановлению (обязательно)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            required
            className="w-full resize-none rounded-lg border border-border px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-200"
          />
        </div>

        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={restoreMut.isPending}
            className="flex-1 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-muted"
          >
            Нет
          </button>
          <button
            type="button"
            onClick={() => restoreMut.mutate()}
            disabled={restoreMut.isPending || !commentOk}
            className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
          >
            {restoreMut.isPending ? "Восстановление…" : "Да, восстановить"}
          </button>
        </div>
      </div>
    </TemplateModal>
  );
}

"use client";

import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SearchableSelect } from "./searchable-select";
import { TemplateModal } from "./template-modal";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  paymentId?: number;
  expeditorOptions: { value: string; label: string }[];
  reasonOptions: { value: string; label: string }[];
  onCreated?: () => void;
};

export function GrantAccessModal({
  open,
  onClose,
  tenantSlug,
  paymentId,
  expeditorOptions,
  reasonOptions,
  onCreated
}: Props) {
  const [accessDuration, setAccessDuration] = useState("");
  const [expeditor, setExpeditor] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAccessDuration("");
      setExpeditor("");
      setReason("");
      setComment("");
      setErr(null);
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!paymentId) throw new Error("NO_PAYMENT");
      const minutes = Number.parseInt(accessDuration, 10);
      if (!Number.isFinite(minutes) || minutes < 1) throw new Error("BAD_DURATION");
      if (!expeditor.trim()) throw new Error("NO_EXPEDITOR");
      await api.post(`/api/${tenantSlug}/payments/${paymentId}/edit-grants`, {
        duration_minutes: minutes,
        access_user_id: Number.parseInt(expeditor, 10),
        cancel_reason_ref: reason.trim() || null,
        comment: comment.trim() || null
      });
    },
    onSuccess: () => {
      onCreated?.();
      onClose();
    },
    onError: (e: unknown) => {
      setErr(getUserFacingError(e, "Не удалось предоставить доступ."));
    }
  });

  return (
    <TemplateModal open={open} onClose={onClose} title="Дать доступ для изменения платежа">
      <div className="space-y-4">
        <div>
          <input
            type="number"
            placeholder="Срок доступа (мин)"
            value={accessDuration}
            onChange={(e) => setAccessDuration(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-200"
          />
        </div>

        <SearchableSelect
          value={expeditor}
          onChange={setExpeditor}
          options={expeditorOptions}
          placeholder="Экспедитор"
        />

        <SearchableSelect
          value={reason}
          onChange={setReason}
          options={reasonOptions}
          placeholder="Причины отмены оплаты"
        />

        <div>
          <textarea
            placeholder="Комментарий"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-border px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-200"
          />
        </div>

        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        <button
          type="button"
          disabled={createMut.isPending}
          onClick={() => {
            setErr(null);
            createMut.mutate();
          }}
          className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
        >
          {createMut.isPending ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </TemplateModal>
  );
}

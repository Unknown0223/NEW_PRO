"use client";

import { SoftVoidConfirmDialog } from "@/components/shared/soft-void-confirm-dialog";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

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
  const [err, setErr] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: async (reason: string) => {
      if (!paymentId) throw new Error("NO_PAYMENT");
      const params = new URLSearchParams();
      if (reason.trim()) params.set("cancel_reason_ref", reason.trim());
      const qs = params.toString();
      await api.delete(`/api/${tenantSlug}/payments/${paymentId}${qs ? `?${qs}` : ""}`);
    },
    onSuccess: () => {
      setErr(null);
      onConfirmed?.();
      onClose();
    },
    onError: (e: unknown) => {
      setErr(getUserFacingError(e, "Не удалось аннулировать платёж."));
    }
  });

  return (
    <SoftVoidConfirmDialog
      open={open}
      onClose={() => {
        if (deleteMut.isPending) return;
        setErr(null);
        onClose();
      }}
      onConfirm={(reason) => deleteMut.mutateAsync(reason)}
      title="Аннулировать оплату"
      description="Оплата будет перенесена в архив. Её можно восстановить позже."
      reasonRequired
      reasonPlaceholder="Причина аннулирования"
      confirmLabel="Аннулировать"
      cancelLabel="Отмена"
      pending={deleteMut.isPending}
      error={err}
      consequences={[
        "Баланс клиента пересчитается",
        "Распределения по заказам будут сняты (снимок сохраняется для восстановления)"
      ]}
    />
  );
}

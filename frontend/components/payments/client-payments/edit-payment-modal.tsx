"use client";

import { EditPaymentDialog } from "@/components/payments/edit-payment-dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  paymentId: number | null;
  clientId: number | null;
  onSaved?: () => void;
};

/** Шаблон «Редактировать оплата» — API через EditPaymentDialog. */
export function EditPaymentModal({ open, onClose, tenantSlug, paymentId, clientId, onSaved }: Props) {
  return (
    <EditPaymentDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      tenantSlug={tenantSlug}
      paymentId={paymentId}
      clientId={clientId ?? 0}
      onSaved={onSaved}
    />
  );
}

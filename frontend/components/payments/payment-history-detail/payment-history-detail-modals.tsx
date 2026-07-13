"use client";

import { Button } from "@/components/ui/button";
import { TemplateModal } from "@/components/payments/client-payments/template-modal";
import { formatPaymentMoney } from "@/components/payments/client-payments/template-ui";
import type { PaymentDetailRow } from "@/lib/payment-detail-types";
import { formatPaymentHistoryDateTime, workflowStatusLabel } from "./payment-history-detail-utils";
import { useState } from "react";

export function PaymentHistoryApproveModal({
  open,
  onClose,
  onConfirm,
  loading,
  payment
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  payment: PaymentDetailRow;
}) {
  return (
    <TemplateModal open={open} onClose={onClose} title="Подтверждение платежа">
      <div className="space-y-4 px-6 pb-6">
        <p className="text-sm text-slate-600">
          Подтвердить платёж <b className="text-slate-800">#{payment.id}</b> на сумму{" "}
          <b className="text-slate-800">{formatPaymentMoney(payment.amount)}</b> от клиента{" "}
          <b className="text-slate-800">{payment.client_name}</b>?
        </p>
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          После подтверждения платёж будет проведён по кассе «{payment.cash_desk_name ?? "—"}».
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "Подтверждение…" : "Подтвердить платеж"}
          </Button>
        </div>
      </div>
    </TemplateModal>
  );
}

export function PaymentHistoryRejectModal({
  open,
  onClose,
  onConfirm,
  loading
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = reason.trim().length < 5;

  return (
    <TemplateModal open={open} onClose={onClose} title="Отклонение платежа">
      <div className="space-y-3 px-6 pb-6">
        <label className="block text-sm font-medium text-slate-600">
          Причина отклонения <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          rows={4}
          placeholder="Укажите причину отклонения платежа (мин. 5 символов)…"
          className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        {touched && invalid ? (
          <p className="text-xs text-red-600">Причина обязательна — минимум 5 символов.</p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={loading}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(reason.trim());
            }}
          >
            {loading ? "Отклонение…" : "Отклонить платеж"}
          </Button>
        </div>
      </div>
    </TemplateModal>
  );
}

function ReceiptPreview({ payment }: { payment: PaymentDetailRow }) {
  const rows: [string, string][] = [
    ["Номер платежа", String(payment.id)],
    ["Клиент", payment.client_name],
    ["Агент", payment.agent_name ?? "—"],
    ["Сумма", formatPaymentMoney(payment.amount)],
    ["Способ оплаты", payment.payment_type],
    ["Касса", payment.cash_desk_name ?? "—"],
    ["Дата оплаты", formatPaymentHistoryDateTime(payment.paid_at) || "—"],
    ["Статус", workflowStatusLabel(payment.workflow_status)],
    ["Кто создал", payment.created_by_name ?? "—"]
  ];
  return (
    <div className="border border-dashed border-slate-300 bg-white p-6 font-mono text-[13px] text-slate-800">
      <div className="mb-1 text-center text-[15px] font-bold tracking-wide">SALEC</div>
      <div className="mb-4 text-center text-[12px] text-slate-500">Квитанция об оплате · № {payment.id}</div>
      <div className="mb-4 border-b border-dashed border-slate-300" />
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-1">
          <span className="text-slate-500">{k}</span>
          <span className="text-right font-semibold">{v}</span>
        </div>
      ))}
      <div className="mt-4 border-t border-dashed border-slate-300 pt-3 text-center text-[11px] text-slate-400">
        Документ сформирован автоматически · {formatPaymentHistoryDateTime(new Date().toISOString())}
      </div>
    </div>
  );
}

export function PaymentHistoryPrintModal({
  open,
  onClose,
  payment,
  onPrint
}: {
  open: boolean;
  onClose: () => void;
  payment: PaymentDetailRow;
  onPrint: () => void;
}) {
  return (
    <TemplateModal open={open} onClose={onClose} title="Печать квитанции — предпросмотр" maxWidth="max-w-2xl">
      <div className="space-y-4 px-6 pb-6">
        <div className="bg-slate-100 p-4">
          <div className="mx-auto max-w-sm shadow-md">
            <ReceiptPreview payment={payment} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          <Button type="button" onClick={onPrint}>
            Печать
          </Button>
        </div>
      </div>
    </TemplateModal>
  );
}

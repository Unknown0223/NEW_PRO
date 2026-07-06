import { useState } from "react";
import { Button, Modal } from "./ui";
import {
  METHOD_CONFIG,
  STATUS_CONFIG,
  formatDateTime,
  formatMoney,
  type Payment,
} from "../data/payment";

// ── RECEIPT (used in print preview + real print) ─────────────
export function Receipt({ payment }: { payment: Payment }) {
  const rows: [string, string][] = [
    ["Номер платежа", payment.number],
    ["Клиент", payment.customer.name],
    ["Агент", payment.agent.fullName],
    ["Сумма", formatMoney(payment.amount, payment.currency)],
    ["Способ оплаты", METHOD_CONFIG[payment.method].label],
    ["Касса", payment.cashbox.name],
    ["Дата оплаты", formatDateTime(payment.paymentDate)],
    ["Статус", STATUS_CONFIG[payment.status].label],
    ["Кто создал", payment.createdBy.fullName],
  ];
  return (
    <div className="border border-dashed border-slate-300 bg-white p-6 font-mono text-[13px] text-slate-800">
      <div className="mb-1 text-center text-[15px] font-bold tracking-wide">ENTERPRISE ERP</div>
      <div className="mb-4 text-center text-[12px] text-slate-500">
        Квитанция об оплате · № {payment.id}
      </div>
      <div className="mb-4 border-b border-dashed border-slate-300" />
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-1">
          <span className="text-slate-500">{k}</span>
          <span className="text-right font-semibold">{v}</span>
        </div>
      ))}
      <div className="mt-4 border-t border-dashed border-slate-300 pt-3 text-center text-[11px] text-slate-400">
        Документ сформирован автоматически · {formatDateTime(new Date().toISOString())}
      </div>
    </div>
  );
}

// ── APPROVE MODAL (POST /payment-history/approve) ────────────
export function ApproveModal({
  open,
  onClose,
  onConfirm,
  loading,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  payment: Payment;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Подтверждение платежа"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button variant="success" onClick={onConfirm} loading={loading}>
            Подтвердить платеж
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-[14px] text-slate-600">
          Вы уверены, что хотите подтвердить платеж{" "}
          <b className="text-slate-800">{payment.number}</b> на сумму{" "}
          <b className="text-slate-800">{formatMoney(payment.amount, payment.currency)}</b> от
          клиента <b className="text-slate-800">{payment.customer.name}</b>?
          <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
            После подтверждения платеж будет проведен по кассе «{payment.cashbox.name}» и запись
            попадет в аудит-журнал.
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── REJECT MODAL (reason required) ───────────────────────────
export function RejectModal({
  open,
  onClose,
  onConfirm,
  loading,
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
    <Modal
      open={open}
      onClose={onClose}
      title="Отклонение платежа"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(reason.trim());
            }}
          >
            Отклонить платеж
          </Button>
        </>
      }
    >
      <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
        Причина отклонения <span className="text-red-500">*</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onBlur={() => setTouched(true)}
        rows={4}
        placeholder="Укажите причину отклонения платежа (мин. 5 символов)…"
        className={`w-full resize-none rounded-md border px-3 py-2 text-[14px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:ring-2 ${
          touched && invalid
            ? "border-red-400 focus:ring-red-100"
            : "border-slate-300 focus:border-teal-500 focus:ring-teal-100"
        }`}
      />
      {touched && invalid && (
        <p className="mt-1 text-[12.5px] text-red-600">
          Причина обязательна — минимум 5 символов.
        </p>
      )}
    </Modal>
  );
}

// ── PRINT MODAL (preview → window.print) ─────────────────────
export function PrintModal({
  open,
  onClose,
  payment,
  onPrint,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment;
  onPrint: () => void;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Печать квитанции — предпросмотр"
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="primary" onClick={onPrint} loading={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
            </svg>
            Печать
          </Button>
        </>
      }
    >
      <div className="bg-slate-100 p-4">
        <div className="mx-auto max-w-sm shadow-md">
          <Receipt payment={payment} />
        </div>
      </div>
    </Modal>
  );
}

// ── PDF MODAL (GET /payment-history/pdf/{id}) ────────────────
export function PdfModal({
  open,
  onClose,
  payment,
  onDownload,
  loading,
  done,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment;
  onDownload: () => void;
  loading: boolean;
  done: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Экспорт в PDF"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="primary" onClick={onDownload} loading={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {done ? "Скачать повторно" : "Сгенерировать и скачать"}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-red-50 text-red-600">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-slate-800">
            payment_{payment.id}_receipt.pdf
          </div>
          <div className="text-[12.5px] text-slate-500">
            {loading
              ? "Генерация PDF… (GET /payment-history/pdf/" + payment.id + ")"
              : done
                ? "Файл успешно сформирован и загружен"
                : "Квитанция об оплате · A4 · ~120 KB"}
          </div>
        </div>
        {done && !loading && (
          <svg className="ml-auto h-5 w-5 shrink-0 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </Modal>
  );
}

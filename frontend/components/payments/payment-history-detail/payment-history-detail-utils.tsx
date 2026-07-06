import { formatPaymentMoney } from "@/components/payments/client-payments/template-ui";
import type { PaymentDetailPayload, PaymentDetailRow } from "@/lib/payment-detail-types";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type PaymentHistoryRow = {
  label: string;
  v1?: ReactNode;
  v2?: ReactNode;
  shaded?: boolean;
};

export type StatusBadgeTone = "pending" | "approved" | "rejected" | "cancelled" | "completed";

export function formatPaymentHistoryDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function workflowStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "pending_confirmation":
      return "Ожидание подтверждения";
    case "confirmed":
      return "Подтверждена";
    case "rejected":
      return "Отклонена";
    case "deleted":
      return "Отменена";
    default:
      return status?.trim() || "—";
  }
}

export function workflowStatusTone(status: string | null | undefined): StatusBadgeTone {
  switch (status) {
    case "pending_confirmation":
      return "pending";
    case "confirmed":
      return "approved";
    case "rejected":
      return "rejected";
    case "deleted":
      return "cancelled";
    default:
      return "completed";
  }
}

export function PaymentHistoryStatusBadge({
  children,
  tone
}: {
  children: ReactNode;
  tone: StatusBadgeTone;
}) {
  const tones: Record<StatusBadgeTone, string> = {
    pending: "bg-cyan-100 text-cyan-600",
    approved: "bg-yellow-100 text-yellow-600",
    rejected: "bg-red-100 text-red-600",
    cancelled: "bg-gray-200 text-gray-600",
    completed: "bg-blue-100 text-blue-600"
  };
  return (
    <span
      className={cn(
        "inline-block rounded-md px-3 py-1.5 text-[14px] leading-none font-medium whitespace-nowrap",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function paymentKindLabel(kind: string | null | undefined): string {
  if (kind === "client_expense") return "Расход";
  return "Приход";
}

function modifiedByLabel(p: PaymentDetailRow): string | undefined {
  if (p.deleted_by_name?.trim()) return p.deleted_by_name.trim();
  if (p.workflow_status === "confirmed" && p.created_by_name?.trim()) return p.created_by_name.trim();
  return undefined;
}

function confirmationLabel(p: PaymentDetailRow): string | undefined {
  if (p.workflow_status === "confirmed") return modifiedByLabel(p);
  if (p.workflow_status === "rejected") return p.deleted_by_name?.trim() || undefined;
  return undefined;
}

export function buildPaymentHistoryRows(data: PaymentDetailPayload): PaymentHistoryRow[] {
  const p = data.payment;
  const dt = (iso: string | null | undefined) =>
    iso ? (
      <span className="font-semibold text-teal-600">{formatPaymentHistoryDateTime(iso)}</span>
    ) : undefined;

  return [
    {
      label: "Дата",
      v1: dt(p.created_at),
      v2: dt(p.confirmed_at ?? p.deleted_at ?? p.paid_at)
    },
    {
      label: "Клиенты",
      v1: p.client_name,
      v2: p.client_legal_name?.trim() || undefined
    },
    { label: "Агент", v1: p.agent_name ?? undefined },
    {
      label: "Статус",
      v1: (
        <PaymentHistoryStatusBadge tone="pending">
          {workflowStatusLabel("pending_confirmation")}
        </PaymentHistoryStatusBadge>
      ),
      v2: (
        <PaymentHistoryStatusBadge tone={workflowStatusTone(p.workflow_status)}>
          {workflowStatusLabel(p.workflow_status)}
        </PaymentHistoryStatusBadge>
      )
    },
    { label: "ID", v2: String(p.id) },
    { label: "Сумма", v1: formatPaymentMoney(p.amount) },
    { label: "Дата оплаты", v1: dt(p.paid_at) },
    {
      label: "Дата создания",
      v1: dt(p.created_at),
      v2: dt(p.confirmed_at ?? p.received_at)
    },
    {
      label: "Баланс клиента",
      v1: formatPaymentMoney(p.client_balance),
      shaded: true
    },
    { label: "Способ оплаты", v1: p.payment_type },
    { label: "Тип выплаты дохода", v1: paymentKindLabel(p.payment_kind) },
    { label: "Направление торговли", v1: p.trade_direction ?? undefined },
    { label: "Касса", v1: p.cash_desk_name ?? undefined },
    {
      label: "Экспедитор",
      v1: p.expeditor_name ?? undefined,
      shaded: true
    },
    { label: "Подтверждение", v2: confirmationLabel(p) },
    { label: "Кто создал", v1: p.created_by_name ?? undefined },
    { label: "Кто изменил", v2: modifiedByLabel(p) },
    {
      label: "Распределено / остаток",
      v2: `${formatPaymentMoney(data.allocated_total)} / ${formatPaymentMoney(data.unallocated)}`
    },
    { label: "Комментарий", v1: p.note?.trim() || undefined, v2: p.delete_reason_ref?.trim() || undefined },
    {
      label: "Связанный заказ",
      v2: p.order_number ?? undefined
    }
  ];
}

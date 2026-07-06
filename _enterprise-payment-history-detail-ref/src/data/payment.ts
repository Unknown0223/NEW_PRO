// ─────────────────────────────────────────────────────────────
// DATABASE MODELS (frontend mirrors of backend entities)
// Payment · Customer · Cashbox · Agent · Expeditor · Approval · AuditLog
// ─────────────────────────────────────────────────────────────

export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
export type PaymentMethod = "CASH" | "TRANSFER" | "TERMINAL" | "MIXED";
export type Role = "VIEWER" | "CASHIER" | "MANAGER" | "ADMIN";

export interface Customer {
  id: number;
  name: string;
  code: string;
}

export interface Cashbox {
  id: number;
  name: string;
  currency: string;
}

export interface UserRef {
  id: number;
  fullName: string;
}

export interface Approval {
  status: PaymentStatus;
  approvedBy: UserRef | null;
  approvedAt: string | null;
  rejectReason: string | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  user: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

export interface Payment {
  id: number;
  number: string;
  customer: Customer;
  agent: UserRef;
  expeditor: UserRef | null;
  tradeDirection: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  incomeType: string;
  method: PaymentMethod;
  cashbox: Cashbox;
  status: PaymentStatus;
  paymentDate: string;
  debtDueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserRef;
  modifiedBy: UserRef;
  approval: Approval;
  comment: string;
}

// ── STATUS CONFIG ────────────────────────────────────────────
export const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; dot: string; badge: string }
> = {
  PENDING: {
    label: "Ожидание подтверждения",
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
  APPROVED: {
    label: "Подтверждена",
    dot: "bg-green-500",
    badge: "bg-green-50 text-green-700 border-green-200",
  },
  REJECTED: {
    label: "Отклонена",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
  CANCELLED: {
    label: "Отменена",
    dot: "bg-gray-400",
    badge: "bg-gray-100 text-gray-600 border-gray-300",
  },
  COMPLETED: {
    label: "Завершена",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

// ── PAYMENT METHOD CONFIG ────────────────────────────────────
export const METHOD_CONFIG: Record<PaymentMethod, { label: string; badge: string }> = {
  CASH: { label: "Наличные", badge: "bg-green-50 text-green-700 border-green-200" },
  TRANSFER: { label: "Перечисления", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  TERMINAL: { label: "Терминал", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  MIXED: { label: "Смешанный", badge: "bg-orange-50 text-orange-700 border-orange-200" },
};

// ── PERMISSION MATRIX ────────────────────────────────────────
// Viewer → Read Only · Cashier → Read/Write · Manager → Approve/Reject · Admin → Full
export const PERMISSIONS: Record<
  Role,
  { edit: boolean; approve: boolean; reject: boolean; print: boolean; pdf: boolean }
> = {
  VIEWER: { edit: false, approve: false, reject: false, print: true, pdf: true },
  CASHIER: { edit: true, approve: false, reject: false, print: true, pdf: true },
  MANAGER: { edit: false, approve: true, reject: true, print: true, pdf: true },
  ADMIN: { edit: true, approve: true, reject: true, print: true, pdf: true },
};

export const ROLE_LABELS: Record<Role, string> = {
  VIEWER: "Наблюдатель",
  CASHIER: "Кассир",
  MANAGER: "Менеджер",
  ADMIN: "Администратор",
};

// ── FORMATTERS ───────────────────────────────────────────────
export function formatMoney(v: number, currency?: string): string {
  const s = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: v % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(v);
  return currency ? `${s} ${currency}` : s;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ── MOCK DATA (simulates GET /payment-history/{id}) ──────────
export const MOCK_PAYMENT: Payment = {
  id: 1000,
  number: "PAY-2026-001000",
  customer: { id: 1, name: "Client01", code: "C-0001" },
  agent: { id: 7, fullName: "Agent User" },
  expeditor: null,
  tradeDirection: "Основное направление",
  amount: 222222,
  currency: "UZS",
  exchangeRate: 1,
  incomeType: "Приход",
  method: "TRANSFER",
  cashbox: { id: 3, name: "kassa", currency: "UZS" },
  status: "PENDING",
  paymentDate: "2026-07-03T21:25:21",
  debtDueDate: null,
  createdAt: "2026-07-03T21:25:48",
  updatedAt: "2026-07-03T21:25:48",
  createdBy: { id: 12, fullName: "Op Anvar" },
  modifiedBy: { id: 12, fullName: "Op Anvar" },
  approval: { status: "PENDING", approvedBy: null, approvedAt: null, rejectReason: null },
  comment: "",
};

// simulates GET /payment-history/audit/{id}
export const MOCK_AUDIT: AuditEntry[] = [
  {
    id: 1,
    at: "2026-07-03T21:25:48",
    user: "Op Anvar",
    action: "Создание платежа",
    field: "Статус",
    oldValue: "—",
    newValue: "Ожидание подтверждения",
  },
  {
    id: 2,
    at: "2026-07-03T21:25:48",
    user: "Op Anvar",
    action: "Изменение записи",
    field: "Сумма",
    oldValue: "0",
    newValue: "222 222",
  },
];

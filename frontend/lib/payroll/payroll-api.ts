"use client";

import { apiFetch } from "@/lib/api-client";
import { formatNumberGrouped } from "@/lib/format-numbers";

export type Ym = { year: number; month: number };

export function currentYm(): Ym {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function ymToInput({ year, month }: Ym): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function inputToYm(v: string): Ym | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function ymQuery({ year, month }: Ym): string {
  return `year=${year}&month=${month}`;
}

export const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

export function ymLabel({ year, month }: Ym): string {
  return `${MONTHS_RU[month - 1] ?? month} ${year}`;
}

export function money(v: number | string | null | undefined, digits = 0): string {
  if (v == null || v === "") return "—";
  return formatNumberGrouped(v, { maxFractionDigits: digits });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const ROLE_RU: Record<string, string> = {
  agent: "Агент",
  expeditor: "Экспедитор",
  supervisor: "Супервайзер",
  operator: "Оператор",
  manager: "Менеджер",
  accountant: "Бухгалтер",
  cashier: "Кассир",
  collector: "Инкассатор",
  auditor: "Аудитор",
  warehouse: "Складчик",
  skladchik: "Складчик",
  director: "Директор",
  admin: "Администратор"
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_RU[role] ?? role;
}

const ERROR_RU: Record<string, string> = {
  NotFound: "Запись не найдена",
  BadMonth: "Неверный месяц",
  BadStatus: "Действие недоступно в текущем статусе",
  PayrollPeriodClosed: "Период закрыт",
  PayrollRecordFrozen: "Зарплата подтверждена — изменения только через корректировку",
  AdvanceLimitExceeded: "Превышен лимит аванса",
  EmployeeNotInScope: "Сотрудник вне вашей зоны доступа",
  InsufficientCash: "Недостаточно средств в кассе",
  NotCashierDesk: "Касса не относится к вашему филиалу",
  PayrollDisabled: "Модуль зарплаты выключен в настройках",
  ReasonRequired: "Укажите причину",
  AmountExceedsBalance: "Сумма больше остатка к выплате",
  BadAmount: "Неверная сумма",
  AdminOnly: "Доступно только администратору",
  NoExchangeRate: "Нет курса валюты на дату выплаты",
  FormulaInvalid: "Ошибка в формуле",
  FormulaInUse: "Формула используется — сначала снимите назначения",
  DuplicateName: "Такое название уже есть",
  SystemItemLocked: "Системную статью нельзя изменить",
  ItemInUse: "Статья используется",
  HasUnconfirmedRecords: "Есть неподтверждённые зарплаты",
  SalaryQueueDisabled: "Выдача зарплаты через очередь выключена",
  NoRecords: "Нет записей",
  PayrollManagedExpense: "Зарплата и аванс оформляются в разделе «Зарплата»",
  PayrollExpenseReadonly: "Запись создана выплатой — изменяется только в разделе «Зарплата»",
  ValidationError: "Проверьте заполнение полей"
};

type ApiErr = Error & { status?: number; apiBody?: { error?: string; message?: string } & Record<string, unknown> };

export function payrollErrorText(e: unknown): string {
  const err = e as ApiErr;
  const code = err?.apiBody?.error;
  const base = (code && ERROR_RU[code]) || err?.apiBody?.message || err?.message || "Ошибка";
  const body = err?.apiBody as Record<string, unknown> | undefined;
  if (code === "AdvanceLimitExceeded" && body) {
    return `${base}: лимит ${money(body.limit as number)}, уже ${money(body.used as number)}, осталось ${money(body.remaining as number)}`;
  }
  if (code === "InsufficientCash" && body) {
    return `${base}: доступно ${money(body.available as number)} ${String(body.currency ?? "")}, нужно ${money(body.required as number)}`;
  }
  if (code === "AmountExceedsBalance" && body) return `${base} (${money(body.balance as number)})`;
  return base;
}

export function payrollApi(tenant: string) {
  const base = `/api/${tenant}/payroll`;
  return {
    get: <T>(path: string) => apiFetch<{ data: T }>(`${base}${path}`).then((r) => r.data),
    send: <T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown) =>
      apiFetch<{ data?: T; ok?: boolean }>(`${base}${path}`, {
        method,
        body: JSON.stringify(body ?? {})
      }).then((r) => r.data as T)
  };
}

export const RECORD_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-slate-100 text-slate-700" },
  pending: { label: "На проверке", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Подтверждено", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Отклонено", cls: "bg-red-100 text-red-700" }
};

export const ADVANCE_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-slate-100 text-slate-700" },
  sent: { label: "Отправлен", cls: "bg-sky-100 text-sky-800" },
  approved: { label: "Утверждён", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Отклонён", cls: "bg-red-100 text-red-700" },
  paid: { label: "Выдан", cls: "bg-violet-100 text-violet-800" },
  cancelled: { label: "Отменён", cls: "bg-zinc-100 text-zinc-500" }
};

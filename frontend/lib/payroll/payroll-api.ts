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
  sales_director: "Коммерческий директор",
  regional_manager: "Региональный менеджер",
  warehouse_manager: "Заведующий складом",
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

export type StatusStyle = { label: string; cls: string; dot: string };

const TONE = {
  slate: { cls: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300", dot: "bg-slate-400" },
  amber: { cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400", dot: "bg-amber-500" },
  emerald: { cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400", dot: "bg-emerald-500" },
  rose: { cls: "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400", dot: "bg-rose-500" },
  sky: { cls: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-400", dot: "bg-sky-500" },
  violet: { cls: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-400", dot: "bg-violet-500" },
  zinc: { cls: "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400", dot: "bg-zinc-400" }
} as const;

export const STATUS_TONE = TONE;

export const RECORD_STATUS: Record<string, StatusStyle> = {
  draft: { label: "Черновик", ...TONE.slate },
  pending: { label: "На проверке", ...TONE.amber },
  confirmed: { label: "Подтверждено", ...TONE.emerald },
  rejected: { label: "Отклонено", ...TONE.rose }
};

export const PAYOUT_KIND: Record<string, StatusStyle> = {
  advance: { label: "Аванс", ...TONE.sky },
  salary: { label: "Зарплата", ...TONE.emerald }
};

export const ADVANCE_STATUS: Record<string, StatusStyle> = {
  draft: { label: "Черновик", ...TONE.slate },
  sent: { label: "Отправлен", ...TONE.sky },
  approved: { label: "Утверждён", ...TONE.emerald },
  rejected: { label: "Отклонён", ...TONE.rose },
  paid: { label: "Выдан", ...TONE.violet },
  cancelled: { label: "Отменён", ...TONE.zinc }
};

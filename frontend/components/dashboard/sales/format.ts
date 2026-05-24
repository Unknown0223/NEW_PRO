import { formatNumberGrouped } from "@/lib/format-numbers";

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  confirmed: "Подтверждена",
  picking: "На сборке",
  delivering: "В доставке",
  delivered: "Доставлена",
  cancelled: "Отказ",
  returned: "Возврат"
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: "Наличные",
  naqd: "Наличные",
  nalichnye: "Наличные",
  card: "Карта",
  terminal: "Терминал",
  transfer: "Перевод",
  bank_transfer: "Банковский перевод",
  click: "Click",
  payme: "Payme",
  uzs_payme: "Payme (UZS)",
  uzs_click: "Click (UZS)"
};

function humanizeToken(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function fmtMoney(v: string | number): string {
  return formatNumberGrouped(v, { minFractionDigits: 2, maxFractionDigits: 2 });
}

export function fmtCount(v: string | number): string {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

export function formatStatusLabel(value: string): string {
  const key = value.trim().toLowerCase();
  const fallback = humanizeToken(value);
  return ORDER_STATUS_LABELS[key] ?? (fallback || "—");
}

export function formatPaymentTypeLabel(value: string): string {
  const key = value.trim().toLowerCase();
  const fallback = humanizeToken(value);
  return PAYMENT_TYPE_LABELS[key] ?? (fallback || "—");
}

export function formatReasonLabel(value: string): string {
  return humanizeToken(value) || "—";
}

export function fileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

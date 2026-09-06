import { fmtDate, fmtDateTime, fmtMoney2, fmtMoneyInt } from "./order-nakladnoy-xlsx.format";

export const CONSIGNMENT_217_VERSION = "2.1.7";

export function formatNakladnoyClientPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("998")) {
    return `+998 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 (${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
  }
  return String(raw ?? "").trim();
}

export function consignment217ClientLine(name: string, phone: string | null | undefined): string {
  const tel = formatNakladnoyClientPhone(phone);
  if (tel) return `Клиент: ${name} (тел: ${tel})`;
  return `Клиент: ${name}`;
}

export function consignment217BalanceLine(balance: number | null): string {
  const n = balance ?? 0;
  return `Баланс клиента: ${fmtMoney2(n)} UZS`;
}

export function consignment217ConsignmentSuffix(isConsignment: boolean): string {
  return isConsignment ? " - НА КОНСИГНАЦИЮ" : "";
}

export function consignment217OrderTitle(number: string, isConsignment: boolean): string {
  return `Заказ (№${number})${consignment217ConsignmentSuffix(isConsignment)}`;
}

export function consignment217BonusTitle(number: string, isConsignment: boolean): string {
  return `Бонус(№${number})${consignment217ConsignmentSuffix(isConsignment)}`;
}

export function consignment217PaymentLabel(ref: string | null | undefined): string {
  const t = String(ref ?? "").trim();
  if (!t) return "NAQD PUL";
  const low = t.toLowerCase();
  if (low === "cash" || low.includes("naqd") || low.includes("налич")) return "NAQD PUL";
  return t.toUpperCase();
}

export function consignment217MoneyWithPay(amount: number, pay: string): string {
  return `${fmtMoneyInt(amount)} ${pay}`.trim();
}

export function consignment217SheetName(expeditorName: string | null | undefined): string {
  const raw = String(expeditorName ?? "").trim() || "Накладная";
  const rest = raw.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 24);
  return `1.217.${rest}`.slice(0, 31);
}

export function consignment217DateLine(at: Date): string {
  return `Дата накладной: ${fmtDate(at)}`;
}

export function consignment217AddressLine(address: string | null | undefined): string {
  const t = String(address ?? "").trim() || "—";
  return `Адрес: ${t}`;
}

export function consignment217ExpeditorLine(name: string | null | undefined): string {
  const t = String(name ?? "").trim();
  return t ? `Экспедитор: ${t}` : "Экспедитор:";
}

export function consignment217AgentValue(opts: {
  code: string;
  name: string;
  territory: string;
  createdAt: Date;
  phone: string | null | undefined;
}): string {
  const code = opts.code.trim() || "—";
  const name = opts.name.trim() || "—";
  const ter = opts.territory.trim();
  const phoneDigits = String(opts.phone ?? "").replace(/\D/g, "");
  const parts = [`${code} [${name}]`];
  if (ter && ter !== "—") parts.push(ter);
  parts.push(fmtDate(opts.createdAt));
  if (phoneDigits) parts.push(`(${phoneDigits})`);
  return parts.join(" ");
}

export function loading520AgentLabel(code: string, name: string, createdAt: Date): string {
  const dd = String(createdAt.getDate()).padStart(2, "0");
  const mm = String(createdAt.getMonth() + 1).padStart(2, "0");
  const yy = String(createdAt.getFullYear()).slice(-2);
  return `${code.trim()} - [${name.trim()}] ${dd}/${mm}/${yy}`;
}

export function loading520Title(at: Date): string {
  return `Загрузочний лист (Время печата: ${fmtDateTime(at)})`;
}

export function loading520SheetName(expeditorName: string | null | undefined): string {
  const raw = String(expeditorName ?? "").trim() || "Загруз";
  const rest = raw.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 24);
  return `1.520.${rest}`.slice(0, 31);
}

/** 5.2.0 Excel — polki qaytarish alohida binafsha guruh. */
export const LOADING_520_SHELF_RETURN_GROUP = "Возврат с полки";

export function isLoading520ShelfReturnType(orderType: string | null | undefined): boolean {
  const t = String(orderType ?? "").trim();
  return t === "return" || t === "return_by_order";
}

/** Tovar guruhlari alifbo bo‘yicha, «Возврат с полки» oxirida. */
export function sortLoading520GroupKeys(keys: string[]): string[] {
  const rest = keys
    .filter((k) => k !== LOADING_520_SHELF_RETURN_GROUP)
    .sort((a, b) => a.localeCompare(b, "ru"));
  if (keys.includes(LOADING_520_SHELF_RETURN_GROUP)) rest.push(LOADING_520_SHELF_RETURN_GROUP);
  return rest;
}

/** Faqat polki qaytarish tanlanganda — 5.2.0 «Возврат с полки» holati (Итого yo‘q). */
export function loading520IsShelfReturnOnly(groupNames: string[]): boolean {
  return groupNames.length > 0 && groupNames.every((n) => n === LOADING_520_SHELF_RETURN_GROUP);
}

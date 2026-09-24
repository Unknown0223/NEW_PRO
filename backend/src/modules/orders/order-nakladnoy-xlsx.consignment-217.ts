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

function hasNakladnoyText(raw: string | null | undefined): boolean {
  const t = String(raw ?? "").trim();
  return t.length > 0 && t !== "—";
}

/**
 * Uzun matnni pechatga sig‘adigan qilib qatorlarga bo‘lish (maxLines).
 * Ortiqcha qisqartiriladi («…») — varaq kengayib ketmasin.
 */
export function wrapNakladnoyFieldText(
  raw: string,
  maxCharsPerLine = 88,
  maxLines = 3
): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= maxCharsPerLine && !t.includes("\n")) return t;
  const lines: string[] = [];
  let rest = t;
  while (rest.length > 0 && lines.length < maxLines) {
    if (rest.length <= maxCharsPerLine) {
      lines.push(rest);
      rest = "";
      break;
    }
    let cut = rest.lastIndexOf(" ", maxCharsPerLine);
    if (cut < Math.floor(maxCharsPerLine / 2)) cut = maxCharsPerLine;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0 && lines.length > 0) {
    const last = lines[lines.length - 1]!;
    const clipped = last.length > 1 ? last.slice(0, Math.max(1, maxCharsPerLine - 1)) : last;
    lines[lines.length - 1] = `${clipped}…`;
  }
  return lines.join("\n");
}

/** Bo‘sh / «—» bo‘lsa null — chaqiruvchi qatorni yozmaydi. */
export function consignment217AddressLine(address: string | null | undefined): string | null {
  if (!hasNakladnoyText(address)) return null;
  return `Адрес: ${wrapNakladnoyFieldText(String(address).trim())}`;
}

export function consignment217LandmarkLine(landmark: string | null | undefined): string | null {
  if (!hasNakladnoyText(landmark)) return null;
  return `Ориентир: ${wrapNakladnoyFieldText(String(landmark).trim())}`;
}

export function consignment217CommentLine(comment: string | null | undefined): string | null {
  if (!hasNakladnoyText(comment)) return null;
  return `Комментарий: ${wrapNakladnoyFieldText(String(comment).trim())}`;
}

/** Skidka > 0 bo‘lsa chiqadi; aks holda null. */
export function consignment217DiscountLine(discountSum: number | null | undefined): string | null {
  const n = Number(discountSum ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `Скидка: ${fmtMoney2(n)} UZS`;
}

export function consignment217ExpeditorLine(name: string | null | undefined): string | null {
  const t = String(name ?? "").trim();
  return t ? `Экспедитор: ${t}` : null;
}

/** 2.1.7: faqat ism; telefon keyingi qatorda. Ism bo‘lmasa null. */
export function consignment217PersonBlock(
  label: string,
  name: string | null | undefined,
  phone: string | null | undefined
): string | null {
  const n = String(name ?? "").trim();
  if (!n || n === "—") return null;
  const tel = formatNakladnoyClientPhone(phone);
  if (tel) return `${label}: ${n}\n${tel}`;
  return `${label}: ${n}`;
}

export function consignment217TerritoryLine(territory: string | null | undefined): string | null {
  if (!hasNakladnoyText(territory)) return null;
  return `Территория: ${wrapNakladnoyFieldText(String(territory).trim(), 88, 2)}`;
}

/** Legacy bir qator (5.2.0 telefon parse va eski testlar). 2.1.7 chopda ishlatilmaydi. */
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

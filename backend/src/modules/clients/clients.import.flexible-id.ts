/**
 * Import / hujjat ID standartlari:
 * - bo‘sh → tizim o‘zi
 * - faqat raqam → ichki DB id
 * - har qanday matn (ks_1652, g3_516, ABC-01…) → tashqi kod / number
 */

import { isPlaceholderCell } from "./clients.import.parse";

const MAX_DOC_ID_LEN = 64;
/** `clients.client_code` — VarChar(32) */
export const MAX_CLIENT_CODE_ID_LEN = 32;

export type ImportFlexibleIdParse =
  | { kind: "absent" }
  | { kind: "ok_db"; id: number }
  | { kind: "ok_code"; code: string }
  | { kind: "invalid"; detail: string };

/** Excel katak: ixtiyoriy; raqam yoki istalgan matnli kod. */
export function classifyFlexibleImportId(
  raw: string | null | undefined,
  opts?: { maxCodeLen?: number; label?: string }
): ImportFlexibleIdParse {
  const label = opts?.label ?? "id";
  const maxCodeLen = opts?.maxCodeLen ?? MAX_DOC_ID_LEN;
  if (raw == null || isPlaceholderCell(raw)) return { kind: "absent" };
  const s = String(raw).trim().replace(/\u00a0/g, " ");
  if (!s) return { kind: "absent" };

  /** Excel ba’zan `12.0` yozadi — butun musbat son → DB id */
  const m = /^(\d+)(?:\.0+)?$/.exec(s);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    if (!Number.isFinite(n) || n < 1) {
      return {
        kind: "invalid",
        detail: `«${s.slice(0, 40)}» — ${label} должен быть целым положительным числом не меньше 1`
      };
    }
    if (n > 2_147_483_647) {
      return { kind: "invalid", detail: `${label} ${n} слишком большой (макс. 2147483647)` };
    }
    return { kind: "ok_db", id: n };
  }

  /** Har qanday boshqa matn: ks_1652, g3_516, ya_2113… */
  if (s.length > maxCodeLen) {
    return {
      kind: "invalid",
      detail: `«${s.slice(0, 40)}» — длина ${label} не более ${maxCodeLen} символов`
    };
  }
  /** Nazorat belgilari / faq taqiqlangan */
  if (/[\u0000-\u001f]/.test(s)) {
    return { kind: "invalid", detail: `${label} содержит недопустимые символы` };
  }
  return { kind: "ok_code", code: s };
}

/** Hujjat raqami (zakaz / to‘lov / vazvrat): bo‘sh → null; aks holda trim. */
export function normalizeExternalDocNumber(
  raw: string | null | undefined,
  maxLen = MAX_DOC_ID_LEN
): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\u00a0/g, " ");
  if (!s || isPlaceholderCell(s)) return null;
  return s.slice(0, maxLen);
}

/** Eski API: faqat DB id (raqam). Matnli kod → null (yangilash uchun classifyFlexibleImportId ishlating). */
export type ImportClientDbIdParse =
  | { kind: "absent" }
  | { kind: "ok"; id: number }
  | { kind: "invalid"; detail: string };

export function classifyImportClientDbId(raw: string | null): ImportClientDbIdParse {
  const r = classifyFlexibleImportId(raw, {
    maxCodeLen: MAX_CLIENT_CODE_ID_LEN,
    label: "ИД"
  });
  if (r.kind === "absent") return { kind: "absent" };
  if (r.kind === "invalid") return { kind: "invalid", detail: r.detail };
  if (r.kind === "ok_db") return { kind: "ok", id: r.id };
  /** Matnli kod — bu yerda «ok» emas; chaqiruvchi flexible parser ishlatsin */
  return {
    kind: "invalid",
    detail: `«${r.code.slice(0, 40)}» — старый API принимает только числовой id; используйте classifyFlexibleImportId`
  };
}

export function parseClientDbIdFromCell(raw: string | null): number | null {
  const r = classifyFlexibleImportId(raw, { maxCodeLen: MAX_CLIENT_CODE_ID_LEN, label: "ИД" });
  return r.kind === "ok_db" ? r.id : null;
}

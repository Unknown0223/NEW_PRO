/** Matritsa narx maydoni: kiritish va saqlash uchun umumiy parse/format */

import { formatGroupedInteger, formatNumberGrouped } from "@/lib/format-numbers";

export const MAX_PRICE_INPUT_LEN = 16;
export const MAX_PRICE_VALUE = 1e12;

const PRICE_INPUT_RE = /^[\d\s.,]*$/;

export function sanitizePriceInput(raw: string): string {
  const t = raw.replace(/[^\d\s.,]/g, "");
  return t.length > MAX_PRICE_INPUT_LEN ? t.slice(0, MAX_PRICE_INPUT_LEN) : t;
}

export function isAllowedPriceInput(raw: string): boolean {
  return PRICE_INPUT_RE.test(raw);
}

export function parsePriceDraft(raw: string): { ok: true; value: number } | { ok: false; reason: string } {
  const t = raw.trim();
  if (t === "") return { ok: false, reason: "empty" };
  const n = Number.parseFloat(t.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return { ok: false, reason: "invalid" };
  if (n > MAX_PRICE_VALUE) return { ok: false, reason: "too_large" };
  return { ok: true, value: n };
}

/** Ko‘rinishda minglik ajratuvchi (masalan 180 000) */
export function formatPriceDraftDisplay(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
    return formatGroupedInteger(Math.round(value));
  }
  return formatNumberGrouped(value, { maxFractionDigits: 2 });
}

export function draftItemsFromMatrix(
  rows: Array<{ product_id: number }>,
  draft: Record<number, string>
): Array<{ product_id: number; price: number }> {
  const items: Array<{ product_id: number; price: number }> = [];
  for (const r of rows) {
    const parsed = parsePriceDraft(draft[r.product_id] ?? "");
    if (parsed.ok) items.push({ product_id: r.product_id, price: parsed.value });
  }
  return items;
}

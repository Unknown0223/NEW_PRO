/** Tabel katak / poseshcheniya → jurnal otmetok deep-link. */

export type DayMarksLinkInput = {
  userId: number;
  dateYmd: string;
};

export type DayMarksLinkQuery = {
  user_id: string;
  from: string;
  to: string;
};

/** `/tabel/marks` uchun query (faqat shu kun + xodim). */
export function dayMarksLinkQuery(input: DayMarksLinkInput): DayMarksLinkQuery | null {
  const userId = Number(input.userId);
  const date = String(input.dateYmd ?? "").trim();
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    user_id: String(Math.trunc(userId)),
    from: date,
    to: date
  };
}

export function dayMarksHref(input: DayMarksLinkInput, basePath = "/tabel/marks"): string | null {
  const q = dayMarksLinkQuery(input);
  if (!q) return null;
  const params = new URLSearchParams(q);
  return `${basePath}?${params.toString()}`;
}

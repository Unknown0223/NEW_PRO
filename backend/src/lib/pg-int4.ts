/** PostgreSQL `INTEGER` (INT4) ustunining eng katta qiymati. */
export const PG_INT4_MAX = 2_147_483_647;

/** Qidiruvdagi raqam INT4 `id` ustuni bilan solishtirishga yaroqlimi (telefon kabi uzun raqamlar emas). */
export function isPgInt4Id(n: number | null | undefined): n is number {
  return n != null && Number.isSafeInteger(n) && n > 0 && n <= PG_INT4_MAX;
}

/** Skidka foizi ko‘rinishi: 10% (yaxlit), 0 yoki bo‘sh — null. */
export function formatDiscountPctLabel(
  pct: number | string | null | undefined,
  opts?: { empty?: string }
): string | null {
  if (pct == null || pct === "") return opts?.empty ?? null;
  const n =
    typeof pct === "number"
      ? pct
      : Number.parseFloat(String(pct).replace(/\s/g, "").replace(",", ".").replace(/%/g, ""));
  if (!Number.isFinite(n) || n <= 0) return opts?.empty ?? null;
  return `${Math.round(n)}%`;
}

/**
 * Zakaz darajasidagi skidka foizi.
 * `total_sum` API da net; gross = net + discount_sum.
 */
export function orderDiscountPctFromSums(
  totalSum: number | string | null | undefined,
  discountSum: number | string | null | undefined
): number | null {
  const net = parseMoney(totalSum);
  const disc = parseMoney(discountSum);
  if (disc <= 0) return null;
  const gross = net > 0 ? net + disc : disc;
  if (gross <= 0) return null;
  return (disc / gross) * 100;
}

function parseMoney(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  return Number.parseFloat(String(v).replace(/\s/g, "").replace(",", ".")) || 0;
}

import { parsePriceDraft } from "@/lib/price-matrix-draft";
import type { PriceMatrixRow } from "@/components/settings/prices/price-matrix-types";

export function countMatrixDraftChanges(
  rows: PriceMatrixRow[],
  draft: Record<number, string>
): number {
  let n = 0;
  for (const r of rows) {
    const parsed = parsePriceDraft(draft[r.product_id] ?? "");
    if (!parsed.ok) continue;
    const prev = parsePriceDraft(r.price ?? "");
    const prevVal = prev.ok ? prev.value : null;
    if (prevVal === null || prevVal !== parsed.value) n += 1;
  }
  return n;
}

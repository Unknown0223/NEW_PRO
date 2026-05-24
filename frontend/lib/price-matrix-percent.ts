import { formatPriceDraftDisplay, parsePriceDraft } from "@/lib/price-matrix-draft";
import type { PriceMatrixRow } from "@/components/settings/prices/price-matrix-types";

export function applyPercentToDraft(
  rows: PriceMatrixRow[],
  draft: Record<number, string>,
  factor: number
): Record<number, string> {
  const next = { ...draft };
  for (const r of rows) {
    const fromDraft = parsePriceDraft(draft[r.product_id] ?? "");
    const fromRow = parsePriceDraft(r.price ?? "");
    const base = fromDraft.ok ? fromDraft.value : fromRow.ok ? fromRow.value : null;
    if (base == null) continue;
    next[r.product_id] = formatPriceDraftDisplay(Math.round(base * factor));
  }
  return next;
}

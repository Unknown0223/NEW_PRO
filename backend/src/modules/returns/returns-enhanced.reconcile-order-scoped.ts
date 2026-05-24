import { previewPolkiAutoBonusReverse } from "./returns-bonus-reverse.preview";
import type { CreatePeriodReturnLine } from "./returns-enhanced.types";

export type ReconciledExplicitLine = {
  product_id: number;
  paid_qty: number;
  bonus_qty: number;
  bonus_cash: number;
  return_qty?: number;
};

/** Po zakaz: klient yuborgan paid/bonus o‘rniga server preview (pullik birinchi). */
export async function reconcileOrderScopedExplicitLinesWithPreview(
  tenantId: number,
  input: {
    client_id: number;
    order_id: number;
    price_type?: string | null;
    lines: CreatePeriodReturnLine[];
  }
): Promise<ReconciledExplicitLine[]> {
  const byProduct = new Map<number, { return_qty: number; bonus_cash: number }>();
  for (const l of input.lines) {
    const phys =
      l.return_qty != null && l.return_qty > 0
        ? l.return_qty
        : (l.paid_qty ?? 0) + (l.bonus_qty ?? 0);
    const cash = l.bonus_cash ?? 0;
    if (!(phys > 0) && !(cash > 0)) continue;
    const cur = byProduct.get(l.product_id) ?? { return_qty: 0, bonus_cash: 0 };
    cur.return_qty += phys;
    cur.bonus_cash += cash;
    byProduct.set(l.product_id, cur);
  }

  const previewLines = [...byProduct.entries()]
    .filter(([, v]) => v.return_qty > 0)
    .map(([product_id, v]) => ({ product_id, return_qty: v.return_qty }));

  const previewByProduct = new Map<number, { paid_qty: number; bonus_qty: number }>();
  if (previewLines.length > 0) {
    const preview = await previewPolkiAutoBonusReverse(tenantId, {
      client_id: input.client_id,
      order_id: input.order_id,
      price_type: input.price_type,
      lines: previewLines
    });
    for (const pl of preview.lines) {
      previewByProduct.set(pl.product_id, { paid_qty: pl.paid_qty, bonus_qty: pl.bonus_qty });
    }
  }

  const out: ReconciledExplicitLine[] = [];
  for (const [product_id, v] of byProduct) {
    const pb = previewByProduct.get(product_id);
    if (v.return_qty > 0 && pb) {
      out.push({
        product_id,
        paid_qty: pb.paid_qty,
        bonus_qty: pb.bonus_qty,
        bonus_cash: v.bonus_cash,
        return_qty: v.return_qty
      });
    } else if (v.bonus_cash > 0) {
      out.push({
        product_id,
        paid_qty: 0,
        bonus_qty: 0,
        bonus_cash: v.bonus_cash
      });
    }
  }
  return out;
}

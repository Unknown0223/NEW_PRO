import type { OrderCashInContext, OrderCashInContextOrder, OrderCashInPaymentMethod, PaymentOrderRow } from "./types";

export function parseAmountInput(raw: string): number {
  if (!raw.trim()) return 0;
  const n = Number.parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function parseNumField(s: string | null | undefined): number {
  const n = Number.parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function existingByTypeToNumbers(raw: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = parseNumField(v);
    if (n > 0) out[k] = n;
  }
  return out;
}

export function sumExisting(row: Pick<PaymentOrderRow, "existingByType">): number {
  return Object.values(row.existingByType).reduce((a, b) => a + b, 0);
}

export function sumDraft(row: Pick<PaymentOrderRow, "draftByMethodId">): number {
  return Object.values(row.draftByMethodId).reduce((a, b) => a + b, 0);
}

export function sumTotalPaid(row: PaymentOrderRow): number {
  return sumExisting(row) + sumDraft(row);
}

export function recomputeRowTotals(row: PaymentOrderRow): PaymentOrderRow {
  const paid = sumTotalPaid(row);
  const unpaid = Math.max(0, row.orderAmount - paid);
  const hasError = paid > row.orderAmount + 0.001;
  return { ...row, unpaid, hasError };
}

export function contextOrderToRow(
  o: OrderCashInContextOrder,
  methods: OrderCashInPaymentMethod[]
): PaymentOrderRow {
  const draftByMethodId: Record<string, number> = {};
  for (const m of methods) {
    draftByMethodId[m.id] = 0;
  }
  return recomputeRowTotals({
    id: o.id,
    clientId: o.client_id,
    clientName: o.client_name,
    status: o.status,
    orderAmount: parseNumField(o.order_amount),
    debt: parseNumField(o.debt ?? "0"),
    existingByType: existingByTypeToNumbers(o.existing_by_type ?? {}),
    draftByMethodId,
    unpaid: 0
  });
}

/**
 * Magnit: qolgan to‘lov faqat bosilgan ustunga — boshqa usullardagi qoralama tozalanadi
 * (NAXT → Terminal: birinchidan yechiladi, ikkinchisiga o‘tadi).
 */
export function fillCellDraftFromOrderAmount(
  row: PaymentOrderRow,
  methodId: string
): PaymentOrderRow {
  const remaining = Math.max(0, row.orderAmount - sumExisting(row));
  const draftByMethodId = Object.fromEntries(
    Object.keys(row.draftByMethodId).map((id) => [id, 0])
  ) as Record<string, number>;
  draftByMethodId[methodId] = remaining;
  return recomputeRowTotals({ ...row, draftByMethodId });
}

/** URL `amount` — birinchi to‘lov usuliga (katalog tartibi) taqsimlanadi. */
export function prefillDraftFromTotalAmount(
  rows: PaymentOrderRow[],
  methods: OrderCashInPaymentMethod[],
  totalAmount: number
): PaymentOrderRow[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || rows.length === 0 || methods.length === 0) {
    return rows;
  }
  const firstId = methods[0]!.id;
  const weights = rows.map((r) => Math.max(0, r.orderAmount - sumExisting(r)));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let allocated = 0;
  return rows.map((r, i) => {
    const isLast = i === rows.length - 1;
    const share =
      weightSum <= 0
        ? isLast
          ? totalAmount - allocated
          : Math.round(totalAmount / rows.length)
        : isLast
          ? Math.max(0, totalAmount - allocated)
          : Math.round((totalAmount * weights[i]!) / weightSum);
    allocated += share;
    const draftByMethodId = { ...r.draftByMethodId, [firstId]: share };
    return recomputeRowTotals({ ...r, draftByMethodId });
  });
}

export function defaultPaidAtLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toIsoFromLocal(local: string): string | undefined {
  if (!local?.trim()) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function buildContextQuery(
  clientId: string,
  orderIds: number[]
): URLSearchParams {
  const p = new URLSearchParams({ client_id: clientId });
  if (orderIds.length > 0) {
    p.set("order_ids", orderIds.join(","));
  }
  return p;
}

export type { OrderCashInContext };

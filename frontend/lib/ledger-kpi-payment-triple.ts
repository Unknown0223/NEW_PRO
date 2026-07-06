/** KPI kartochkalari va balance-detail: spravochnik «способы оплаты» → Naqd / Perechis / Terminal */

export const KPI_TRIPLE_LABELS = ["Naqd", "Perechis", "Terminal"] as const;

export function parseLedgerKpiAmount(s: string | null | undefined): number {
  const t = String(s ?? "")
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/\u2212/g, "-")
    .replace(/−/g, "-")
    .replace(/,/g, ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeKpiTriple(
  rows: { label: string; amount: string }[]
): { label: string; amount: string }[] {
  const nrm = (l: string) => l.trim().toLowerCase().replace(/\s+/g, " ");
  const sum = [0, 0, 0];
  for (const r of rows) {
    const t = nrm(r.label);
    const v = parseLedgerKpiAmount(r.amount);
    let idx: number | null = null;
    if (
      t.includes("terminal") ||
      t.includes("plastik") ||
      t.includes("plastic") ||
      t.includes("пласт") ||
      t.includes("карт") ||
      t.includes("термин")
    ) {
      idx = 2;
    } else if (
      t.includes("perechis") ||
      t.includes("перечис") ||
      (t.includes("bank") && !t.includes("plast")) ||
      t.includes("transfer")
    ) {
      idx = 1;
    } else if (t.includes("naqd") || t.includes("налич") || t.includes("cash") || t.includes("нақд") || t.includes("нал")) {
      idx = 0;
    }
    if (idx != null) sum[idx] += v;
  }
  return KPI_TRIPLE_LABELS.map((label, i) => ({ label, amount: String(sum[i]) }));
}

export type KpiPaymentSubLine = { label: string; amount: number };

/** Haqiqiy qiymatlar: avvalo KPI triple, bo‘lmasa API label/amount qatorlari. */
export function resolveCardPaymentSubLines(
  paymentByType: { label: string; amount: string }[]
): KpiPaymentSubLine[] {
  if (!paymentByType.length) {
    return KPI_TRIPLE_LABELS.map((label) => ({ label, amount: 0 }));
  }

  const normalized = normalizeKpiTriple(paymentByType);
  const normalizedSum = normalized.reduce((s, r) => s + parseLedgerKpiAmount(r.amount), 0);
  const rawNonZero = paymentByType
    .map((r) => ({ label: r.label.trim() || "—", amount: parseLedgerKpiAmount(r.amount) }))
    .filter((r) => r.amount !== 0);

  if (normalizedSum !== 0) {
    return normalized.map((r) => ({ label: r.label, amount: parseLedgerKpiAmount(r.amount) }));
  }
  if (rawNonZero.length > 0) {
    return rawNonZero;
  }
  return normalized.map((r) => ({ label: r.label, amount: parseLedgerKpiAmount(r.amount) }));
}

import {
  paymentMethodStorageKey,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";

export const INCOME_OTHER_PAYMENT_KEY = "__other__";
export const INCOME_OTHER_PAYMENT_LABEL = "Прочие";

export type IncomeCatalogColumn = { key: string; label: string };

export function buildIncomeCatalogColumns(entries: PaymentMethodEntryDto[]): IncomeCatalogColumn[] {
  return entries
    .filter((e) => e.active !== false)
    .map((e) => ({
      key: paymentMethodStorageKey(e),
      label: e.name.trim()
    }))
    .filter((c) => c.key.length > 0 && c.label.length > 0);
}

/** DB `payment_type` → katalog saqlash kaliti (yoki «Прочие»). */
export function resolveIncomePaymentBucketKey(
  rawPaymentType: string,
  entries: PaymentMethodEntryDto[]
): string {
  const trimmed = (rawPaymentType ?? "").trim();
  if (!trimmed) return INCOME_OTHER_PAYMENT_KEY;

  const active = entries.filter((e) => e.active !== false);
  const directActive = active.find((e) => paymentMethodStorageKey(e) === trimmed);
  if (directActive) return paymentMethodStorageKey(directActive);

  const label = resolvePaymentMethodRefToLabel(trimmed, entries);
  if (label) {
    const byName = entries.find((e) => e.name.trim() === label);
    if (byName) return paymentMethodStorageKey(byName);
  }

  const directAny = entries.find((e) => paymentMethodStorageKey(e) === trimmed);
  if (directAny) return paymentMethodStorageKey(directAny);

  return INCOME_OTHER_PAYMENT_KEY;
}

export function buildIncomePaymentTypeLabels(columns: IncomeCatalogColumn[]): Record<string, string> {
  const labels: Record<string, string> = Object.fromEntries(columns.map((c) => [c.key, c.label]));
  labels[INCOME_OTHER_PAYMENT_KEY] = INCOME_OTHER_PAYMENT_LABEL;
  return labels;
}

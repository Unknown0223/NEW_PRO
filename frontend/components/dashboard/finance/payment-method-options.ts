import type { useDashboardMeta } from "@/lib/use-dashboard-meta";
import { resolvePaymentMethodDisplayLabel } from "@/lib/payment-method-options";

type ProfileRefs = NonNullable<ReturnType<typeof useDashboardMeta>["profileRefs"]>;
type ReportFilters = { payment_methods?: Array<{ id: string; label: string }> };

export type PaymentMethodOption = { value: string; label: string; code?: string };

export function buildPaymentMethodOptions(
  profileRefs: ProfileRefs | undefined,
  reportFilters?: ReportFilters
): PaymentMethodOption[] {
  const fromReport = reportFilters?.payment_methods ?? [];
  if (fromReport.length > 0) {
    return fromReport.map((x) => ({ value: x.id, label: x.label }));
  }
  const fromEntries = (profileRefs?.payment_method_entries ?? [])
    .filter((p) => p?.active !== false)
    .map((p) => {
      const id = String(p.id ?? "").trim();
      const label = String(p.name ?? "").trim();
      const code = typeof p.code === "string" ? p.code.trim() : "";
      return { value: id, label, code };
    })
    .filter((p) => p.value && p.label);
  if (fromEntries.length > 0) return fromEntries;
  const legacy = (profileRefs?.payment_types ?? [])
    .map((x) => String(x).trim())
    .filter(Boolean)
    .map((x) => ({ value: x, label: x }));
  return legacy;
}

export function formatPaymentMethodLabel(
  value: string,
  fallbackName?: string,
  entries?: Array<{ id: string; name: string; code?: string | null }>
): string {
  if (fallbackName?.trim()) return fallbackName.trim();
  return resolvePaymentMethodDisplayLabel(value, entries);
}

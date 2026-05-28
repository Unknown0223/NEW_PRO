import { listWarehousesForTenant } from "../reference/reference.warehouse.list";
import { getTenantProfile } from "../tenant-settings/tenant-settings.service";
import {
  defaultCurrencyCodeFromEntries,
  normalizeCurrencyCode,
  resolveCurrencyEntries
} from "../tenant-settings/finance-refs";
import type { AutoConfirmRuleInput, RestrictionRuleInput } from "./order-automation.types";
import { isWarehouseEligibleForAutomationScope } from "./order-automation.warehouse-scope";

function normalizePositiveIds(ids: readonly number[] | undefined): number[] {
  return [...new Set((ids ?? []).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}

export async function resolveAllowedCurrencyCode(
  tenantId: number,
  raw: string | undefined
): Promise<string> {
  const profile = await getTenantProfile(tenantId);
  const entries = resolveCurrencyEntries((profile.references ?? {}) as Record<string, unknown>);
  const active = entries.filter((e) => e.active !== false);
  const allowed = new Set(active.map((e) => e.code));
  const fallback = defaultCurrencyCodeFromEntries(active.length ? active : entries);
  const code = normalizeCurrencyCode(raw?.trim() || fallback);
  if (!code || !allowed.has(code)) throw new Error("VALIDATION");
  return code;
}

export function validateRuleAmounts(amountFrom: number | null | undefined, amountTo: number | null | undefined): void {
  if (amountFrom != null && amountTo != null && amountFrom > amountTo) {
    throw new Error("VALIDATION");
  }
}

export async function normalizeScopeWarehouseIds(
  tenantId: number,
  ids: number[] | undefined
): Promise<number[]> {
  const requested = normalizePositiveIds(ids);
  if (!requested.length) return [];
  const warehouses = await listWarehousesForTenant(tenantId);
  const allowed = new Set(
    warehouses.filter((w) => isWarehouseEligibleForAutomationScope(w)).map((w) => w.id)
  );
  return requested.filter((id) => allowed.has(id));
}

export function validateRestrictionInput(input: RestrictionRuleInput): void {
  const name = input.name?.trim();
  if (!name) throw new Error("VALIDATION");
  validateRuleAmounts(input.amount_from, input.amount_to);
}

export function validateAutoConfirmInput(input: AutoConfirmRuleInput): void {
  validateRestrictionInput(input);
  const exec = input.execution_type ?? "instant";
  if (exec === "business_days_n" && (input.n_value == null || input.n_value < 1)) {
    throw new Error("VALIDATION");
  }
  if (exec === "exact_time" && !input.execution_time?.trim()) {
    throw new Error("VALIDATION");
  }
}

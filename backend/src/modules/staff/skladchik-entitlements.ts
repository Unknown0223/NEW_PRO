import type { Prisma } from "@prisma/client";

/** Skladchik «Конфигурации» — faqat ushbu kalitlar saqlanadi (qolganlari e’tiborsiz). */
export const SKLADCHIK_ENTITLEMENT_KEYS = [
  "sales_warehouse_list",
  "return_warehouse_list",
  "receipt_list",
  "receipt_add",
  "receipt_confirm",
  "receipt_change",
  "stock_balance_list",
  "correction_list",
  "correction_add",
  "transfer_list",
  "transfer_add",
  "assembly_list",
  "assembly_detail",
  "assembly_create",
  "assembly_collect",
  "assembly_verify",
  "shipping_list",
  "shipping_detail",
  "shipping_confirm",
  "shipping_excel",
  "shipping_create",
  "return_invoice_list",
  "return_invoice_detail",
  "return_invoice_confirm",
  "warehouse_block_list",
  "warehouse_block_confirm_empty"
] as const;

export type SkladchikEntitlementKey = (typeof SKLADCHIK_ENTITLEMENT_KEYS)[number];

const KEY_SET = new Set<string>(SKLADCHIK_ENTITLEMENT_KEYS);

export function sanitizeWarehouseStaffEntitlements(
  input: Record<string, boolean> | null | undefined
): Record<string, boolean> {
  if (input == null || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, boolean> = {};
  for (const k of SKLADCHIK_ENTITLEMENT_KEYS) {
    if (input[k] === true) out[k] = true;
  }
  return out;
}

/** API javobi: barcha kalitlar boolean (UI uchun). */
export function normalizeWarehouseStaffEntitlementsRow(v: unknown): Record<SkladchikEntitlementKey, boolean> {
  const s = sanitizeWarehouseStaffEntitlements(v as Record<string, boolean>);
  const out = {} as Record<SkladchikEntitlementKey, boolean>;
  for (const k of SKLADCHIK_ENTITLEMENT_KEYS) {
    out[k] = s[k] === true;
  }
  return out;
}

export function assertValidEntitlementsKeys(input: Record<string, boolean>): void {
  for (const k of Object.keys(input)) {
    if (!KEY_SET.has(k)) throw new Error("BAD_ENTITLEMENT_KEY");
  }
}

export function toPrismaJsonEntitlements(
  input: Record<string, boolean> | null | undefined
): Prisma.InputJsonValue {
  return sanitizeWarehouseStaffEntitlements(input ?? undefined) as Prisma.InputJsonValue;
}

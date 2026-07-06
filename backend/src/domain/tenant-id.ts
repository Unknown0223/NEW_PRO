/** Tenant identifikatori — musbat butun son. */
export type TenantId = number & { readonly __brand: "TenantId" };

export function tenantIdFrom(value: number): TenantId {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("INVALID_TENANT_ID");
  }
  return value as TenantId;
}

export function tenantIdToNumber(id: TenantId): number {
  return id;
}

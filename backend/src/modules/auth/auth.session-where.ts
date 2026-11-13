/** Shu qurilmadan tashqari faol sessiyalar (limit hisobi). */
export function otherActiveSessionsWhere(args: {
  userId: number;
  tenantId: number;
  deviceId: string | null;
  now?: Date;
}): {
  user_id: number;
  tenant_id: number;
  revoked_at: null;
  expires_at: { gt: Date };
  OR?: Array<{ device_id: null } | { device_id: { not: string } }>;
} {
  const now = args.now ?? new Date();
  const base = {
    user_id: args.userId,
    tenant_id: args.tenantId,
    revoked_at: null,
    expires_at: { gt: now }
  };
  if (!args.deviceId) return base;
  return {
    ...base,
    OR: [{ device_id: null }, { device_id: { not: args.deviceId } }]
  };
}

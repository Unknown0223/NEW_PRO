/** Integratsiya/audit testlari qoldirgan texnik ombor nomlari. */
export function isIntegrationTestWarehouseName(name: string): boolean {
  const n = name.trim();
  return /^AuditWh_\d+$/i.test(n) || /^TST[-_]/i.test(n);
}

export function isWarehouseEligibleForAutomationScope(w: {
  is_active: boolean | null | undefined;
  name: string;
}): boolean {
  return w.is_active === true && !isIntegrationTestWarehouseName(w.name);
}

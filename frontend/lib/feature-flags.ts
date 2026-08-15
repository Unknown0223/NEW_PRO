/**
 * SALEC feature flags — frontend environment variables.
 */

function envFlag(name: string, defaultEnabled = true): boolean {
  const value = process.env[name]?.trim();
  if (value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  return defaultEnabled;
}

/** Virtual Pivot Engine — default yoqilgan; `NEXT_PUBLIC_PIVOT_ENGINE=false` bilan o'chirish. */
export function isPivotEngineEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_PIVOT_ENGINE", true);
}

/**
 * Soft-void arxiv / restore UI. Default yoqilgan.
 * `NEXT_PUBLIC_SOFT_VOID_V1=0` — arxiv toggle va restore tugmalarini yashirish (backend soft-void qoladi).
 */
export function isSoftVoidUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_SOFT_VOID_V1", true);
}

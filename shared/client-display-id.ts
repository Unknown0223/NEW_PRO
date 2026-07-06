/** SalesDoc / Lalaku tashqi mijoz kodi: `ur_29411` (2 belgi + `_` + ichki id). */
export const EXTERNAL_CLIENT_CODE_RE = /^[a-z0-9]{2}_(\d+)$/i;

export function isExternalClientCode(raw: string): boolean {
  return EXTERNAL_CLIENT_CODE_RE.test(raw.trim());
}

/** `ur_29411` → 29411 */
export function parseExternalClientCodeSuffix(raw: string): number | null {
  const m = EXTERNAL_CLIENT_CODE_RE.exec(raw.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** UI / Excel: `client_code` bo‘lsa shu, aks holda ichki id. */
export function formatClientDisplayId(clientId: number, clientCode?: string | null): string {
  const code = clientCode?.trim();
  if (code) return code;
  return String(clientId);
}

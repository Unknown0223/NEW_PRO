/** Lokal demo seed identifikatorlari — prod client/CAA ga tegmasin. */

export const VISITS_SEED_NOTE = "VISITS-SEED";
/** Clients jadvalida alohida code yo‘q — nom bilan identifikatsiya. */
export const VISITS_SEED_CLIENT_NAME = "VISITS-SEED Demo Client";

export function isLocalDatabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = (u.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /@(localhost|127\.0\.0\.1|::1)([:/]|$)/i.test(url);
  }
}

/** Veb/mobil: refresh sessiya — qat’iy maksimal 1 soat (30 kunlik «eslab qolish» yo‘q). */
export const REFRESH_TOKEN_TTL_MS = 60 * 60 * 1000;
export const REFRESH_COOKIE_MAX_AGE_SEC = 60 * 60;

export function refreshExpiresAt(fromMs = Date.now()): Date {
  return new Date(fromMs + REFRESH_TOKEN_TTL_MS);
}

/**
 * Brauzer/qurilma uchun barqaror identifikator.
 * `localStorage` da saqlanadi — shu qurilmadan qayta kirilganda backend
 * o'sha qurilmaning eski sessiyasini almashtiradi ("bitta qurilma — bitta sessiya").
 */

const DEVICE_ID_KEY = "savdo-device-id";

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Qurilma identifikatorini oladi yoki birinchi marta yaratib saqlaydi. */
export function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) return existing.trim().slice(0, 64);
    const fresh = randomId().slice(0, 64);
    window.localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** Login uchun o'qiladigan qurilma nomi (brauzer/OS asosida qisqa matn). */
export function describeDevice(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" :
    "Браузер";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" :
    "ПК";
  return `${browser} · ${os} (веб)`.slice(0, 255);
}

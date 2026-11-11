/** Offline/retry dublikatini oldini olish uchun client UUID. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeClientUuid(raw: string | null | undefined): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.length > 64) return null;
  if (!UUID_RE.test(s)) return null;
  return s.toLowerCase();
}

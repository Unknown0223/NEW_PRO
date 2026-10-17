/** Mobilga yuboriladigan bitta profil rasmi manzili. Kalit o‘zi yuborilmaydi. */
export function profilePhotoMobileUrl(
  stored: string | null | undefined,
  slug: string,
  clientId: number,
  version?: Date | string | number | null
): string | null {
  const value = stored?.trim() ?? "";
  const tenant = slug.trim();
  if (!value || !tenant || !Number.isInteger(clientId) || clientId < 1) return null;
  if (/^https?:\/\//i.test(value)) return value.length <= 2048 ? value : null;
  const stamp = photoVersionStamp(version);
  const query = stamp ? `?v=${stamp}` : "";
  return `/api/${tenant}/clients/${clientId}/profile-photo${query}`;
}

function photoVersionStamp(version?: Date | string | number | null): string {
  if (version instanceof Date) {
    const ms = version.getTime();
    return Number.isFinite(ms) ? String(ms) : "";
  }
  if (typeof version === "number" && Number.isFinite(version)) return String(Math.trunc(version));
  if (typeof version === "string" && version.trim()) {
    const ms = Date.parse(version);
    return Number.isFinite(ms) ? String(ms) : "";
  }
  return "";
}

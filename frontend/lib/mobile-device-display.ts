/** Web panel: mobil APK versiyasi (faqat 2.0.8, +208 yashirin). */
export function formatApkVersion(v: string | null | undefined): string {
  const s = v?.trim();
  if (!s) return "—";
  return s.split("+")[0].trim() || "—";
}

/** Web panel: tushunarli qurilma nomi (emulyator texnik nomlari yashiriladi). */
export function formatDeviceName(v: string | null | undefined): string {
  const s = v?.trim();
  if (!s) return "—";
  const lower = s.toLowerCase();
  if (
    lower.includes("sdk_gphone") ||
    lower.includes("emulator") ||
    lower.includes("generic") ||
    lower.includes("goldfish") ||
    /^google\s+sdk/i.test(s)
  ) {
    return "Android Emulator";
  }
  return s;
}

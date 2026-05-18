/** «Описание», «Раздел»: «A / B / C» — faqat oxirgi qism (`/`). Bo‘sh bo‘lsa `emptyFallback`. */
export function displayAccessDescriptionShort(
  description: string | null | undefined,
  keyFallback: string
): string {
  const raw = (description ?? "").trim();
  if (!raw) return keyFallback;
  const bySlash = raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (bySlash.length > 1) return bySlash[bySlash.length - 1]!;
  return raw;
}

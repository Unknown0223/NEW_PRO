/** Picker-labels: faqat nom. */
export function sharePersonDisplayName(
  u:
    | {
        name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | null
    | undefined
): string {
  if (!u) return "";
  const fromParts = [u.last_name, u.first_name]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromParts) return fromParts;
  return typeof u.name === "string" ? u.name.trim() : "";
}

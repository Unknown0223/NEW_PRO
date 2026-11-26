/** Picker-labels: faqat inson o‘qiydigan nom (kod/login qo‘shilmaydi). */
export function coverPersonDisplayName(
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
